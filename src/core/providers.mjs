import { requestText } from './feeds.mjs';

// Official REST documentation checked 2026-10-20. These are API-key endpoints,
// not consumer subscriptions or browser-session endpoints.
// https://developers.openai.com/api/docs/guides/text
// https://developers.openai.com/api/reference/resources/models/methods/list
// https://ai.google.dev/api/generate-content and https://ai.google.dev/api/models
// https://docs.x.ai/developers/model-capabilities/legacy/chat-completions
// https://docs.x.ai/developers/rest-api-reference/inference/models
// https://api-docs.deepseek.com/api/create-chat-completion/
// https://api-docs.deepseek.com/api/list-models/
const PROVIDERS = Object.freeze({
  openai: { name: 'OpenAI', origin: 'https://api.openai.com', path: '/v1' },
  gemini: { name: 'Gemini', origin: 'https://generativelanguage.googleapis.com', path: '/v1beta' },
  grok: { name: 'Grok', origin: 'https://api.x.ai', path: '/v1' },
  deepseek: { name: 'DeepSeek', origin: 'https://api.deepseek.com', path: '' },
});
const MAX_OUTPUT_TOKENS = 12_000;
const MAX_RESPONSE_CHARS = 120_000;

export class ProviderError extends Error {
  constructor(message, code = 'PROVIDER_ERROR') {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}

function endpoint(provider, baseUrl = '') {
  if (provider === 'local') {
    let url;
    try {
      if (typeof baseUrl !== 'string' || baseUrl.length > 2048 || !baseUrl) throw new Error();
      url = new URL(baseUrl);
    } catch { throw new ProviderError('Configure a loopback OpenAI-compatible local model URL, such as http://127.0.0.1:11434/v1.', 'INVALID_ENDPOINT'); }
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
        !['127.0.0.1', '::1', 'localhost'].includes(host) || !['', '/', '/v1', '/v1/'].includes(url.pathname)) {
      throw new ProviderError('Local models must use a loopback HTTP(S) address with the /v1 API path.', 'INVALID_ENDPOINT');
    }
    return { name: 'Local model', origin: url.origin, base: `${url.origin}/v1`, policy: 'local' };
  }
  const config = PROVIDERS[provider];
  if (!config) throw new ProviderError('Select a supported model provider.', 'INVALID_PROVIDER');
  if (baseUrl) {
    let url;
    try { url = new URL(baseUrl); } catch { throw new ProviderError('Use the official provider API endpoint.', 'INVALID_ENDPOINT'); }
    const paths = ['', '/', config.path, `${config.path}/`];
    if (provider === 'deepseek') paths.push('/v1', '/v1/');
    if (url.origin !== config.origin || url.username || url.password || url.search || url.hash || !paths.includes(url.pathname)) {
      throw new ProviderError('Only the official API endpoint for this provider is supported.', 'INVALID_ENDPOINT');
    }
  }
  return { ...config, base: config.origin + config.path, policy: 'public' };
}

function credentialHeaders(provider, apiKey) {
  if (provider === 'local' && !apiKey) return {};
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 4096 || /[\r\n\u0000]/.test(apiKey)) {
    throw new ProviderError('Add your own provider API key in Settings first.', 'MISSING_API_KEY');
  }
  return provider === 'gemini' ? { 'x-goog-api-key': apiKey.trim() } : { authorization: `Bearer ${apiKey.trim()}` };
}

function boundedString(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /\u0000/.test(value)) {
    throw new ProviderError(`The ${label} is missing or exceeds the allowed size.`, 'INVALID_INPUT');
  }
  return value;
}

function modelId(value, provider) {
  boundedString(value, 200, 'model ID');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value) || value.split('/').some(part => part === '..' || part === '.')) {
    throw new ProviderError('Use a model ID returned by the provider, without URL parameters.', 'INVALID_MODEL');
  }
  if (provider === 'gemini') {
    const id = value.replace(/^models\//, '');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) throw new ProviderError('Select a Gemini model ID from the model list.', 'INVALID_MODEL');
    return id;
  }
  return value;
}

function parseJSON(text) {
  try {
    const result = JSON.parse(text);
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result;
  } catch { throw new ProviderError('The provider returned an invalid JSON response.', 'INVALID_RESPONSE'); }
}

function responseText(result, provider) {
  let text;
  if (provider === 'openai') {
    if (result.status && result.status !== 'completed') throw new ProviderError('The model did not finish its response. Choose a suitable text model or reduce the article count.', 'INCOMPLETE_RESPONSE');
    text = (Array.isArray(result.output) ? result.output : [])
      .filter(item => item?.type === 'message' && item.role === 'assistant')
      .flatMap(item => Array.isArray(item.content) ? item.content : [])
      .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
      .map(part => part.text).join('\n');
  } else if (provider === 'gemini') {
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new ProviderError('Gemini did not finish a usable text response. Check the selected model and article count.', 'INCOMPLETE_RESPONSE');
    text = (Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
      .filter(part => typeof part?.text === 'string' && part.thought !== true).map(part => part.text).join('\n');
  } else {
    const choice = result.choices?.[0];
    if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new ProviderError('The model did not finish its response. Choose a suitable text model or reduce the article count.', 'INCOMPLETE_RESPONSE');
    text = choice?.message?.content;
    // OpenAI-compatible local servers may return content parts instead of a string.
    if (Array.isArray(text)) text = text.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n');
  }
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_RESPONSE_CHARS) {
    throw new ProviderError('The provider returned no usable text, or its response exceeded the size limit.', 'INVALID_RESPONSE');
  }
  return text.trim();
}

/** Dependency injection is used by offline tests; the default client always uses the pinned transport. */
export function createProviderClient({ request = requestText } = {}) {
  async function call(config, provider, apiKey, path, { body, signal, timeoutMs = 150_000 } = {}) {
    const headers = { accept: 'application/json', ...credentialHeaders(provider, apiKey) };
    if (body !== undefined) headers['content-type'] = 'application/json';
    let response;
    try {
      response = await request(`${config.base}${path}`, {
        method: body === undefined ? 'GET' : 'POST', headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal, timeoutMs, maxBytes: 2 * 1024 * 1024, maxRedirects: 0,
        policy: config.policy, allowedOrigins: [config.origin],
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new ProviderError(error?.code === 'TIMEOUT' ? 'The model request timed out. No automatic paid retry was made.' : 'The provider could not be reached through its approved API endpoint.', error?.code === 'TIMEOUT' ? 'TIMEOUT' : 'NETWORK_ERROR');
    }
    if (response.status < 200 || response.status >= 300) {
      const status = Number(response.status) || 0;
      const hint = status === 401 ? 'Check your provider API key.' : status === 403 ? 'Check model access and provider regional availability.' : status === 429 ? 'Check API quota, billing, or rate limits.' : status === 400 || status === 404 ? 'Check that this model ID supports the selected text API.' : 'Try again later after checking the provider service.';
      // Never echo provider response bodies: they can contain prompts, secrets,
      // internal paths, or arbitrary remote text.
      throw new ProviderError(`${config.name} API returned HTTP ${status}. ${hint}`, `HTTP_${status}`);
    }
    return parseJSON(response.text);
  }

  async function listModels({ provider, apiKey, baseUrl = '', signal } = {}) {
    const config = endpoint(provider, baseUrl);
    const found = [];
    let pageToken = '';
    const visitedTokens = new Set();
    for (let page = 0; page < 10; page++) {
      const path = provider === 'gemini' ? `/models?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}` : '/models';
      const result = await call(config, provider, apiKey, path, { signal, timeoutMs: 20_000 });
      const models = provider === 'gemini' ? result.models : result.data;
      if (!Array.isArray(models)) throw new ProviderError('The provider returned no valid model list.', 'INVALID_RESPONSE');
      for (const item of models.slice(0, 2000)) {
        if (!item || typeof item !== 'object') continue;
        if (provider === 'gemini' && Array.isArray(item.supportedGenerationMethods) && !item.supportedGenerationMethods.includes('generateContent')) continue;
        try {
          const id = modelId(provider === 'gemini' ? item.name : item.id, provider);
          const name = typeof item.displayName === 'string' ? item.displayName.replace(/[\u0000-\u001f<>]/g, '').slice(0, 150) : id;
          found.push({ id, name: name || id });
        } catch { /* An invalid catalog entry never becomes a request path. */ }
      }
      if (provider !== 'gemini' || !result.nextPageToken) break;
      if (typeof result.nextPageToken !== 'string' || result.nextPageToken.length > 2048 || visitedTokens.has(result.nextPageToken)) throw new ProviderError('The provider returned an invalid model-list page token.', 'INVALID_RESPONSE');
      pageToken = result.nextPageToken;
      visitedTokens.add(pageToken);
    }
    return [...new Map(found.map(item => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  async function complete({ provider, model, apiKey, baseUrl = '', system, prompt, signal } = {}) {
    const config = endpoint(provider, baseUrl);
    const selectedModel = modelId(model, provider);
    boundedString(system, 24_000, 'system instruction');
    boundedString(prompt, 180_000, 'source-grounded prompt');
    let path;
    let body;
    if (provider === 'openai') {
      path = '/responses';
      body = { model: selectedModel, instructions: system, input: prompt, max_output_tokens: MAX_OUTPUT_TOKENS, store: false };
    } else if (provider === 'gemini') {
      path = `/models/${encodeURIComponent(selectedModel)}:generateContent`;
      body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: 'application/json' } };
    } else {
      path = '/chat/completions';
      body = { model: selectedModel, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: MAX_OUTPUT_TOKENS, stream: false };
    }
    const result = await call(config, provider, apiKey, path, { body, signal });
    return responseText(result, provider);
  }

  return { listModels, complete };
}

const client = createProviderClient();
export const listModels = client.listModels;
export const complete = client.complete;
