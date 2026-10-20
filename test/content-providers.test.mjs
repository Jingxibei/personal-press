import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderClient } from '../src/core/providers.mjs';

const args = { apiKey: 'TEST_ONLY_KEY', model: 'user-selected-model', system: 'Return plain JSON.', prompt: '{"sources":[]}' };

function clientWith(handler) {
  return createProviderClient({ request: async (url, options) => ({ status: 200, text: JSON.stringify(await handler(url, options)) }) });
}

test('OpenAI uses official Responses REST endpoint and extracts all text message parts', async () => {
  const client = clientWith((url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.authorization, 'Bearer TEST_ONLY_KEY');
    assert.equal(options.maxRedirects, 0);
    assert.deepEqual(options.allowedOrigins, ['https://api.openai.com']);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'user-selected-model');
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 12000);
    assert.equal(body.instructions, args.system);
    assert.equal(body.input, args.prompt);
    assert.equal(body.tools, undefined);
    return { status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"articles":[]}' }] }] };
  });
  assert.equal(await client.complete({ ...args, provider: 'openai' }), '{"articles":[]}');
});

test('Gemini uses an API-key header, supported content shape and no key in the URL', async () => {
  const client = clientWith((url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/user-selected-model:generateContent');
    assert.equal(url.includes('TEST_ONLY_KEY'), false);
    assert.equal(options.headers['x-goog-api-key'], 'TEST_ONLY_KEY');
    assert.equal(options.headers.authorization, undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.systemInstruction.parts[0].text, args.system);
    assert.equal(body.contents[0].parts[0].text, args.prompt);
    assert.equal(body.generationConfig.maxOutputTokens, 12000);
    return { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'not user-facing reasoning' }, { text: '{"articles":[]}' }] } }] };
  });
  assert.equal(await client.complete({ ...args, model: 'models/user-selected-model', provider: 'gemini' }), '{"articles":[]}');
});

test('Grok and DeepSeek use their own official chat-completion endpoints', async () => {
  for (const [provider, endpoint] of [['grok', 'https://api.x.ai/v1/chat/completions'], ['deepseek', 'https://api.deepseek.com/chat/completions']]) {
    const client = clientWith((url, options) => {
      assert.equal(url, endpoint);
      assert.equal(options.headers.authorization, 'Bearer TEST_ONLY_KEY');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'user-selected-model');
      assert.equal(body.messages[0].role, 'system');
      assert.equal(body.messages[1].content, args.prompt);
      assert.equal(body.max_tokens, 12000);
      assert.equal(body.stream, false);
      return { choices: [{ finish_reason: 'stop', message: { content: '{"articles":[]}' } }] };
    });
    assert.equal(await client.complete({ ...args, provider }), '{"articles":[]}');
  }
});

test('local adapter uses only a loopback OpenAI-compatible /v1 endpoint with an optional key', async () => {
  const client = clientWith((url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(options.policy, 'local');
    assert.equal(options.headers.authorization, undefined);
    return { choices: [{ message: { content: 'local response' }, finish_reason: 'stop' }] };
  });
  assert.equal(await client.complete({ ...args, provider: 'local', baseUrl: 'http://127.0.0.1:11434', apiKey: '' }), 'local response');
});

test('custom cloud origins, endpoint paths and non-loopback local endpoints are rejected before network', async () => {
  let calls = 0;
  const client = clientWith(() => { calls++; return {}; });
  for (const [provider, baseUrl] of [
    ['openai', 'https://example.org/v1'], ['openai', 'https://api.openai.com.evil.example/v1'],
    ['gemini', 'https://generativelanguage.googleapis.com/v1beta/other'],
    ['grok', 'http://api.x.ai/v1'], ['deepseek', 'https://key:secret@api.deepseek.com'],
    ['local', 'http://192.168.1.1:11434/v1'], ['local', 'http://127.0.0.1:11434/admin'],
    ['local', 'https://api.openai.com/v1'],
  ]) await assert.rejects(client.complete({ ...args, provider, baseUrl }), { code: 'INVALID_ENDPOINT' });
  assert.equal(calls, 0);
});

test('malformed model paths and header injection cannot reach the provider', async () => {
  let calls = 0;
  const client = clientWith(() => { calls++; return {}; });
  for (const model of ['models/../secrets', 'my-model?key=secret', '<script>', 'name\nheader']) await assert.rejects(client.complete({ ...args, provider: 'gemini', model }));
  await assert.rejects(client.complete({ ...args, provider: 'openai', apiKey: 'key\r\nx-evil: yes' }), { code: 'MISSING_API_KEY' });
  assert.equal(calls, 0);
});

test('model list preserves actual provider IDs without promoting an invented latest model', async () => {
  for (const [provider, url] of [['openai', 'https://api.openai.com/v1/models'], ['grok', 'https://api.x.ai/v1/models'], ['deepseek', 'https://api.deepseek.com/models']]) {
    const client = clientWith(requestUrl => {
      assert.equal(requestUrl, url);
      return { data: [{ id: 'model-b' }, { id: 'model-a' }, { id: 'model-a' }, { id: '<unsafe>' }] };
    });
    assert.deepEqual(await client.listModels({ provider, apiKey: args.apiKey }), [{ id: 'model-a', name: 'model-a' }, { id: 'model-b', name: 'model-b' }]);
  }
});

test('Gemini model listing filters generateContent support and follows bounded pagination', async () => {
  let calls = 0;
  const client = clientWith((url, options) => {
    calls++;
    assert.equal(options.headers['x-goog-api-key'], args.apiKey);
    assert.equal(url.includes(args.apiKey), false);
    if (calls === 1) return { models: [{ name: 'models/text-a', displayName: 'Text A', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed-a', supportedGenerationMethods: ['embedContent'] }], nextPageToken: 'next page' };
    assert.match(url, /pageToken=next%20page/);
    return { models: [{ name: 'models/text-b', supportedGenerationMethods: ['generateContent'] }] };
  });
  assert.deepEqual(await client.listModels({ provider: 'gemini', apiKey: args.apiKey }), [{ id: 'text-a', name: 'Text A' }, { id: 'text-b', name: 'text-b' }]);
  assert.equal(calls, 2);
});

test('provider failures are safe and do not retry a paid request or echo its body', async () => {
  let calls = 0;
  const client = createProviderClient({ request: async () => { calls++; return { status: 429, text: '{"error":"TEST_ONLY_KEY /private/path user prompt secret"}' }; } });
  await assert.rejects(client.complete({ ...args, provider: 'openai' }), error => {
    assert.equal(error.code, 'HTTP_429');
    assert.match(error.message, /quota/);
    assert.doesNotMatch(error.message, /TEST_ONLY_KEY|private\/path|prompt secret/);
    return true;
  });
  assert.equal(calls, 1);
});

test('truncated, refused and oversized completions are rejected', async () => {
  for (const [provider, response] of [
    ['openai', { status: 'incomplete', output: [] }],
    ['gemini', { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{partial' }] } }] }],
    ['grok', { choices: [{ finish_reason: 'length', message: { content: '{partial' } }] }],
    ['deepseek', { choices: [{ finish_reason: 'stop', message: { content: 'x'.repeat(120001) } }] }],
  ]) await assert.rejects(clientWith(() => response).complete({ ...args, provider }));
});
