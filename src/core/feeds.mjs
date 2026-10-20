import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { isIP, BlockList } from 'node:net';
import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const DEFAULT_WINDOW_HOURS = 48;
const privateV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) privateV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const specialV6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
]) specialV6.addSubnet(address, prefix, 'ipv6');

export class ContentNetworkError extends Error {
  constructor(message, code = 'NETWORK_ERROR') {
    super(message);
    this.name = 'ContentNetworkError';
    this.code = code;
  }
}

function abortError() {
  const error = new ContentNetworkError('The request was canceled.', 'ABORTED');
  error.name = 'AbortError';
  return error;
}

function checkAbort(signal) {
  if (signal?.aborted) throw abortError();
}

function hostName(url) {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

export function isLoopbackAddress(address) {
  return address === '::1' || (isIP(address) === 4 && address.startsWith('127.'));
}

/** Conservative global-unicast allowlist. IPv4-mapped IPv6 and transition ranges fail closed. */
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !privateV4.check(address, 'ipv4');
  if (family === 6) return globalV6.check(address, 'ipv6') && !specialV6.check(address, 'ipv6');
  return false;
}

export function validatePublicUrl(input) {
  let url;
  try {
    if (typeof input !== 'string' || input.length > 4096) throw new Error();
    url = new URL(input);
  } catch {
    throw new ContentNetworkError('Enter a valid public HTTPS URL.', 'UNSAFE_URL');
  }
  const host = hostName(url);
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443') || !host || host.endsWith('.') ||
      host === 'localhost' || /\.(?:localhost|local|internal|home|lan|test|invalid)$/i.test(host) ||
      (isIP(host) ? !isPublicAddress(host) : !host.includes('.'))) {
    throw new ContentNetworkError('Only public HTTPS addresses on port 443 are allowed.', 'UNSAFE_URL');
  }
  url.hash = '';
  return url;
}

function validateLocalUrl(input) {
  let url;
  try { url = new URL(input); } catch {
    throw new ContentNetworkError('Enter a loopback model URL.', 'UNSAFE_URL');
  }
  const host = hostName(url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !(host === 'localhost' || isLoopbackAddress(host))) {
    throw new ContentNetworkError('Local models must use localhost or a loopback IP address.', 'UNSAFE_URL');
  }
  url.hash = '';
  return url;
}

function waitAbort(promise, signal) {
  checkAbort(signal);
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function resolvePublicUrl(input, { lookup = dnsLookup, signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  checkAbort(signal);
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 5000);
  try {
    return await resolveUrl(input, { lookup, signal: controller.signal, policy: 'public' });
  } catch (error) {
    if (timedOut) throw new ContentNetworkError('The source-link DNS check timed out.', 'TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function resolveUrl(input, { lookup, signal, policy }) {
  checkAbort(signal);
  const url = policy === 'local' ? validateLocalUrl(input) : validatePublicUrl(input);
  const host = hostName(url);
  let records;
  try {
    records = isIP(host) ? [{ address: host, family: isIP(host) }] :
      await waitAbort(Promise.resolve().then(() => lookup(host, { all: true, verbatim: true })), signal);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ContentNetworkError('The host could not be resolved.', 'DNS_ERROR');
  }
  const allowed = policy === 'local' ? isLoopbackAddress : isPublicAddress;
  if (!Array.isArray(records) || !records.length || records.length > 64 ||
      records.some(record => !allowed(record.address))) {
    throw new ContentNetworkError('The host resolves to a private, local, or reserved address.', 'PRIVATE_ADDRESS');
  }
  return { url, addresses: records.map(record => ({ address: record.address, family: isIP(record.address) })) };
}

/**
 * Node transport pins the validated DNS result to the socket lookup, preventing a
 * second DNS answer from redirecting the connection to an internal address.
 * Dependencies are injectable solely so tests need neither network nor API keys.
 */
export function createNetworkClient({ lookup = dnsLookup, https = httpsRequest, http = httpRequest } = {}) {
  return async function requestText(input, {
    method = 'GET', headers = {}, body, signal, timeoutMs = 15_000,
    maxBytes = MAX_FEED_BYTES, maxRedirects = 4, policy = 'public', allowedOrigins,
  } = {}) {
    if (!['GET', 'POST'].includes(method) || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 4 * 1024 * 1024) {
      throw new ContentNetworkError('Invalid request limits.', 'INVALID_REQUEST');
    }
    if (body != null && (typeof body !== 'string' || Buffer.byteLength(body) > 512 * 1024)) {
      throw new ContentNetworkError('The request is too large.', 'TOO_LARGE');
    }
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    checkAbort(signal);
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, Math.min(Math.max(timeoutMs, 1), 180_000));
    try {
      let current = input;
      for (let hop = 0; ; hop++) {
        const { url, addresses } = await resolveUrl(current, { lookup, signal: controller.signal, policy });
        if (allowedOrigins && !allowedOrigins.includes(url.origin)) {
          throw new ContentNetworkError('The endpoint is not an approved provider address.', 'UNSAFE_URL');
        }
        const result = await new Promise((resolve, reject) => {
          const transport = url.protocol === 'https:' ? https : http;
          const pinned = addresses[0];
          // No cookie jar, proxy, automatic redirect, or unverified TLS override.
          const request = transport(url, {
            method,
            headers: { 'user-agent': 'PersonalPress/0.1', 'accept-encoding': 'identity', ...headers },
            agent: false,
            family: pinned.family,
            lookup: (_host, options, callback) => {
              if (typeof options === 'function') { callback = options; options = {}; }
              callback(null, options?.all ? [pinned] : pinned.address, pinned.family);
            },
            signal: controller.signal,
          }, response => {
            const status = response.statusCode || 0;
            const responseHeaders = response.headers || {};
            if (status >= 300 && status < 400) {
              response.resume();
              resolve({ status, headers: responseHeaders, text: '', url: url.href });
              return;
            }
            const length = Number(responseHeaders['content-length']);
            if (Number.isFinite(length) && length > maxBytes) {
              response.destroy();
              request.destroy();
              reject(new ContentNetworkError('The response exceeds the download limit.', 'TOO_LARGE'));
              return;
            }
            // Asking for identity avoids compressed payload expansion. A server
            // ignoring it is rejected rather than unboundedly decompressed.
            if (responseHeaders['content-encoding'] && responseHeaders['content-encoding'] !== 'identity') {
              response.destroy();
              request.destroy();
              reject(new ContentNetworkError('The server returned an unsupported compressed response.', 'UNSUPPORTED_ENCODING'));
              return;
            }
            let lengthRead = 0;
            const chunks = [];
            response.on('data', chunk => {
              lengthRead += chunk.length;
              if (lengthRead > maxBytes) {
                response.destroy();
                request.destroy();
                reject(new ContentNetworkError('The response exceeds the download limit.', 'TOO_LARGE'));
              } else chunks.push(Buffer.from(chunk));
            });
            response.on('error', () => reject(new ContentNetworkError('The response could not be read.', 'NETWORK_ERROR')));
            response.on('aborted', () => reject(new ContentNetworkError('The response was interrupted.', 'NETWORK_ERROR')));
            response.on('end', () => resolve({ status, headers: responseHeaders, text: Buffer.concat(chunks).toString('utf8'), url: url.href }));
          });
          request.on('error', error => {
            reject(error?.name === 'AbortError' ? abortError() : new ContentNetworkError('The connection could not be completed.', 'NETWORK_ERROR'));
          });
          if (body != null) request.write(body);
          request.end();
        });
        if (result.status >= 300 && result.status < 400) {
          // Authenticated POST requests and provider listing requests always use
          // maxRedirects=0. Public feed redirects carry only public GET headers.
          if (hop >= maxRedirects || method !== 'GET' || Object.keys(headers).some(k => /authorization|cookie|api.key/i.test(k))) {
            throw new ContentNetworkError('The request was redirected beyond its allowed boundary.', 'REDIRECT_BLOCKED');
          }
          const location = result.headers.location;
          if (typeof location !== 'string' || location.length > 4096) {
            throw new ContentNetworkError('The server returned an invalid redirect.', 'REDIRECT_BLOCKED');
          }
          try { current = new URL(location, url).href; } catch {
            throw new ContentNetworkError('The server returned an invalid redirect.', 'REDIRECT_BLOCKED');
          }
          continue;
        }
        return result;
      }
    } catch (error) {
      if (timedOut) throw new ContentNetworkError('The request timed out.', 'TIMEOUT');
      if (signal?.aborted) throw abortError();
      if (error instanceof ContentNetworkError) throw error;
      throw new ContentNetworkError('The network request failed.', 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  };
}

export const requestText = createNetworkClient();

function decodeEntities(value) {
  const names = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };
  return value.replace(/&(#(?:x[0-9a-f]{1,6}|[0-9]{1,7})|[a-z]{2,8});/gi, (all, entity) => {
    if (entity[0] !== '#') return names[entity.toLowerCase()] ?? all;
    const hex = entity[1].toLowerCase() === 'x';
    const n = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
  });
}

function nodeText(value, depth = 0) {
  if (depth > 8 || value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.slice(0, 200).map(v => nodeText(v, depth + 1)).join(' ');
  if (typeof value === 'object') return Object.entries(value).filter(([key]) => !key.startsWith('@_')).slice(0, 200).map(([, v]) => nodeText(v, depth + 1)).join(' ');
  return '';
}

export function plainFeedText(value, maxLength = 2400) {
  let text = nodeText(value).slice(0, 40_000);
  for (let i = 0; i < 2; i++) {
    text = decodeEntities(text).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]{0,2000}>/g, ' ');
  }
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function canonicalSourceUrl(input, base) {
  let url;
  try { url = new URL(input, base); } catch {
    throw new ContentNetworkError('A feed item has an invalid source link.', 'UNSAFE_URL');
  }
  url = validatePublicUrl(url.href);
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(?:fbclid|gclid|dclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
  }
  return url.href;
}

function parsePublishedAt(value) {
  const text = nodeText(value).trim();
  // No locale-dependent, missing-year, or timezone-less dates.
  if (text.length > 100 || !/\d{4}/.test(text) || !/(?:Z|[+-]\d{2}:?\d{2}|\b(?:GMT|UTC|[ECMP][SD]T))\s*$/i.test(text)) return null;
  const stamp = Date.parse(text);
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
}

function list(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }

function parseFeed(xml) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > MAX_FEED_BYTES) throw new ContentNetworkError('The feed is too large.', 'TOO_LARGE');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) || /<(?:__proto__|constructor|prototype)(?:\s|>)/i.test(xml)) {
    throw new ContentNetworkError('DTD, entities, and unsafe XML constructs are not supported.', 'UNSAFE_XML');
  }
  let depth = 0;
  let tags = 0;
  const withoutLiterals = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, '');
  for (const match of withoutLiterals.matchAll(/<\/?[a-zA-Z_][^>]*>/g)) {
    if (++tags > 50_000) throw new ContentNetworkError('The feed contains too many XML nodes.', 'UNSAFE_XML');
    const tag = match[0];
    if (tag.startsWith('</')) depth--;
    else if (!tag.endsWith('/>')) depth++;
    if (depth > 48) throw new ContentNetworkError('The feed XML is nested too deeply.', 'UNSAFE_XML');
  }
  if (XMLValidator.validate(xml) !== true) throw new ContentNetworkError('The source is not a valid RSS or Atom XML feed.', 'INVALID_FEED');
  let parsed;
  try {
    parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, processEntities: false, trimValues: true, ignoreDeclaration: true, ignorePiTags: true }).parse(xml);
  } catch { throw new ContentNetworkError('The source is not a valid RSS or Atom feed.', 'INVALID_FEED'); }
  const channel = parsed.rss?.channel ?? parsed.RDF;
  const atom = parsed.feed;
  if (!channel && !atom) throw new ContentNetworkError('The source must be an RSS or Atom feed.', 'INVALID_FEED');
  return { publisher: plainFeedText((channel ?? atom).title, 160), entries: list(channel?.item ?? atom?.entry).slice(0, 200), atom: !!atom };
}

function entryUrl(entry, atom) {
  if (atom) {
    const links = list(entry.link);
    const selected = links.find(link => typeof link === 'object' && (!link['@_rel'] || link['@_rel'] === 'alternate') && (!link['@_type'] || link['@_type'] === 'text/html'));
    return decodeEntities(selected?.['@_href'] ?? '');
  }
  const linked = decodeEntities(nodeText(entry.link)).trim();
  if (linked) return linked;
  const guid = entry.guid;
  if (typeof guid === 'object' && guid['@_isPermaLink'] === 'false') return '';
  return decodeEntities(nodeText(guid)).trim();
}

function windowHours(value, fallback = DEFAULT_WINDOW_HOURS) {
  return Number.isFinite(value) && value >= 1 && value <= 168 ? value : fallback;
}

export function createSourceCollector({ request = requestText, resolve = resolvePublicUrl } = {}) {
  return async function collectSources(sources, { now = new Date(), maxItems = 24, signal, seenUrls = [], freshnessHours = DEFAULT_WINDOW_HOURS } = {}) {
    checkAbort(signal);
    const nowMs = new Date(now).getTime();
    if (!Number.isFinite(nowMs)) throw new Error('A valid source cutoff time is required.');
    const retrievedAt = new Date(nowMs).toISOString();
    maxItems = Number.isInteger(maxItems) ? Math.max(1, Math.min(maxItems, 100)) : 24;
    if (!Array.isArray(sources)) throw new Error('Add your own public RSS or Atom sources first.');
    const enabled = sources.filter(source => source && source.enabled !== false).slice(0, 50);
    const errors = [];
    const collected = [];
    const seen = new Set();
    for (const value of seenUrls instanceof Set ? seenUrls : Array.isArray(seenUrls) ? seenUrls : []) {
      try { seen.add(canonicalSourceUrl(value)); } catch { /* historical invalid URLs are ignored */ }
    }
    const resolutionCache = new Map();
    const validateLink = async url => {
      const host = new URL(url).hostname;
      if (!resolutionCache.has(host)) {
        const promise = resolve(url, { signal });
        resolutionCache.set(host, promise);
      }
      await resolutionCache.get(host);
    };
    const externalSignal = signal;
    const deadline = new AbortController();
    const cancelCollection = () => deadline.abort();
    externalSignal?.addEventListener('abort', cancelCollection, { once: true });
    const collectionTimer = setTimeout(cancelCollection, 60_000);
    signal = deadline.signal;
    let cursor = 0;
    const worker = async () => {
      while (cursor < enabled.length) {
        const source = enabled[cursor++];
        checkAbort(signal);
        const sourceId = plainFeedText(source.id || 'source', 80);
        try {
          const feedUrl = validatePublicUrl(source.url).href;
          const response = await request(feedUrl, { signal, timeoutMs: 15_000, maxBytes: MAX_FEED_BYTES, maxRedirects: 4, headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9' } });
          if (response.status < 200 || response.status >= 300) throw new ContentNetworkError(`The feed returned HTTP ${Number(response.status) || 0}.`, 'HTTP_ERROR');
          const feed = parseFeed(response.text);
          const latestCutoff = nowMs - windowHours(source.freshnessHours, windowHours(freshnessHours)) * 3_600_000;
          const skipped = { undated: 0, stale: 0, future: 0, unsafe: 0, empty: 0 };
          for (const entry of feed.entries.slice(0, Math.max(20, Math.min(60, maxItems * 2)))) {
            checkAbort(signal);
            if (!entry || typeof entry !== 'object') continue;
            const publishedAt = parsePublishedAt(entry.pubDate ?? entry.published ?? entry.date ?? entry.updated);
            if (!publishedAt) { skipped.undated++; continue; }
            const stamp = Date.parse(publishedAt);
            if (stamp < latestCutoff) { skipped.stale++; continue; }
            if (stamp > nowMs) { skipped.future++; continue; }
            const title = plainFeedText(entry.title, 350);
            const excerpt = plainFeedText(entry.description ?? entry.summary ?? entry.encoded ?? entry.content, 2400);
            if (!title || !excerpt) { skipped.empty++; continue; }
            try {
              const rawUrl = entryUrl(entry, feed.atom);
              if (!rawUrl) throw new Error();
              const url = canonicalSourceUrl(rawUrl, response.url ?? feedUrl);
              if (seen.has(url)) continue;
              await validateLink(url);
              collected.push({ id: `s-${createHash('sha256').update(url).digest('hex').slice(0, 20)}`, title, url, publisher: feed.publisher || plainFeedText(source.label, 160) || new URL(url).hostname, publishedAt, retrievedAt, excerpt });
            } catch (error) {
              if (error?.name === 'AbortError') throw error;
              skipped.unsafe++;
            }
          }
          if (Object.values(skipped).some(Boolean)) errors.push({ sourceId, code: 'ITEMS_EXCLUDED', message: `Excluded feed entries: ${skipped.undated} without a usable date, ${skipped.stale} outside the freshness window, ${skipped.future} after the cutoff, ${skipped.unsafe} unsafe links, ${skipped.empty} without a title and summary.` });
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          errors.push({ sourceId, code: error instanceof ContentNetworkError ? error.code : 'FEED_ERROR', message: error instanceof ContentNetworkError ? error.message : 'This feed could not be read.' });
        }
      }
    };
    try {
      const outcomes = await Promise.allSettled(Array.from({ length: Math.min(enabled.length, 4) }, worker));
      checkAbort(externalSignal);
      if (outcomes.some(outcome => outcome.status === 'rejected')) errors.push({ sourceId: 'collection', code: 'COLLECTION_TIMEOUT', message: 'The collection deadline was reached; only source excerpts already checked are used.' });
    } finally {
      clearTimeout(collectionTimer);
      externalSignal?.removeEventListener('abort', cancelCollection);
    }
    const uniqueTitles = new Set();
    const items = [];
    collected.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.url.localeCompare(b.url));
    for (const item of collected) {
      const normalizedTitle = item.title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      if (seen.has(item.url) || uniqueTitles.has(normalizedTitle)) continue;
      seen.add(item.url);
      uniqueTitles.add(normalizedTitle);
      items.push(item);
      if (items.length >= maxItems) break;
    }
    return { items, errors };
  };
}

export const collectSources = createSourceCollector();
