import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createNetworkClient, createSourceCollector, resolvePublicUrl, validatePublicUrl, isPublicAddress, canonicalSourceUrl, plainFeedText } from '../src/core/feeds.mjs';

const PUBLIC = '93.184.216.34';
const NOW = new Date('2026-10-20T12:00:00Z');
const publicLookup = async () => [{ address: PUBLIC, family: 4 }];

function transportFor(routes, calls = []) {
  return (url, options, callback) => {
    const request = new EventEmitter();
    let body = '';
    request.write = chunk => { body += chunk; };
    request.destroy = () => {};
    request.end = () => queueMicrotask(() => {
      calls.push({ url: url.href, options, body });
      const route = routes[url.href];
      if (!route) { request.emit('error', new Error('Unexpected network target')); return; }
      const response = Readable.from(route.chunks ?? [Buffer.from(route.body ?? '')]);
      response.statusCode = route.status ?? 200;
      response.headers = route.headers ?? {};
      callback(response);
    });
    return request;
  };
}

test('public-address policy blocks private, reserved and IPv4-mapped IPv6 destinations', () => {
  for (const address of ['0.0.0.0', '10.8.0.1', '100.100.100.200', '127.0.0.1', '169.254.169.254', '172.31.1.2', '192.168.1.1', '192.0.2.1', '198.19.0.1', '224.0.0.1', '255.255.255.255', '::', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '2001:db8::1', '2002:7f00:1::']) assert.equal(isPublicAddress(address), false, address);
  for (const address of [PUBLIC, '8.8.8.8', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(isPublicAddress(address), true, address);
});

test('feed URLs reject credentials, insecure schemes, private numeric forms and non-HTTPS ports', () => {
  for (const url of ['file:///etc/passwd', 'http://example.org/feed', 'https://user:secret@example.org/feed', 'https://127.1/feed', 'https://2130706433/feed', 'https://0x7f000001/feed', 'https://[::ffff:127.0.0.1]/feed', 'https://localhost/feed', 'https://device.local/feed', 'https://example.org:8080/feed', 'https://example.org./feed']) assert.throws(() => validatePublicUrl(url), { code: 'UNSAFE_URL' }, url);
  assert.equal(validatePublicUrl('https://example.org/feed#fragment').href, 'https://example.org/feed');
});

test('DNS validation rejects mixed public and private answers', async () => {
  await assert.rejects(resolvePublicUrl('https://example.org/feed', { lookup: async () => [{ address: PUBLIC, family: 4 }, { address: '127.0.0.1', family: 4 }] }), { code: 'PRIVATE_ADDRESS' });
});

test('socket lookup pins the single validated DNS answer instead of resolving again', async () => {
  let lookups = 0;
  const calls = [];
  const request = createNetworkClient({ lookup: async () => { lookups++; return [{ address: lookups === 1 ? PUBLIC : '127.0.0.1', family: 4 }]; }, https: transportFor({ 'https://example.org/feed': { body: 'ok' } }, calls) });
  const result = await request('https://example.org/feed');
  assert.equal(result.text, 'ok');
  assert.equal(lookups, 1);
  const addresses = await new Promise((resolve, reject) => calls[0].options.lookup('example.org', { all: true }, (error, value) => error ? reject(error) : resolve(value)));
  assert.deepEqual(addresses, [{ address: PUBLIC, family: 4 }]);
  assert.equal(calls[0].options.agent, false);
  assert.equal(calls[0].options.headers['accept-encoding'], 'identity');
});

test('every redirect is validated and never connects to a private target', async () => {
  const calls = [];
  const request = createNetworkClient({ lookup: publicLookup, https: transportFor({ 'https://example.org/feed': { status: 302, headers: { location: 'https://127.0.0.1/private' } } }, calls) });
  await assert.rejects(request('https://example.org/feed'), { code: 'UNSAFE_URL' });
  assert.equal(calls.length, 1);
});

test('redirect to a hostname with a private DNS answer is rejected', async () => {
  const calls = [];
  const request = createNetworkClient({ lookup: async host => [{ address: host === 'other.example.org' ? '10.0.0.1' : PUBLIC, family: 4 }], https: transportFor({ 'https://example.org/feed': { status: 307, headers: { location: 'https://other.example.org/feed' } } }, calls) });
  await assert.rejects(request('https://example.org/feed'), { code: 'PRIVATE_ADDRESS' });
  assert.equal(calls.length, 1);
});

test('authorization headers never follow redirects, even to a public host', async () => {
  const request = createNetworkClient({ lookup: publicLookup, https: transportFor({ 'https://example.org/feed': { status: 302, headers: { location: 'https://other.example.org/feed' } } }) });
  await assert.rejects(request('https://example.org/feed', { headers: { authorization: 'Bearer TEST_ONLY' } }), { code: 'REDIRECT_BLOCKED' });
});

test('download limits cover both announced and chunked oversized bodies', async () => {
  for (const route of [{ body: 'hello', headers: { 'content-length': '100' } }, { chunks: [Buffer.alloc(8), Buffer.alloc(8)] }]) {
    const request = createNetworkClient({ lookup: publicLookup, https: transportFor({ 'https://example.org/feed': route }) });
    await assert.rejects(request('https://example.org/feed', { maxBytes: 10 }), { code: 'TOO_LARGE' });
  }
});

test('compressed responses are not expanded without a bound', async () => {
  const request = createNetworkClient({ lookup: publicLookup, https: transportFor({ 'https://example.org/feed': { headers: { 'content-encoding': 'gzip' }, body: 'compressed' } }) });
  await assert.rejects(request('https://example.org/feed'), { code: 'UNSUPPORTED_ENCODING' });
});

test('request deadline includes a DNS lookup that never answers', async () => {
  const request = createNetworkClient({ lookup: () => new Promise(() => {}) });
  await assert.rejects(request('https://example.org/feed', { timeoutMs: 5 }), { code: 'TIMEOUT' });
});

test('local policy accepts only a loopback endpoint and validates localhost DNS', async () => {
  const request = createNetworkClient({ lookup: async () => [{ address: '10.0.0.1', family: 4 }] });
  await assert.rejects(request('http://localhost:11434/v1/models', { policy: 'local' }), { code: 'PRIVATE_ADDRESS' });
  await assert.rejects(request('http://192.168.1.20:11434/v1/models', { policy: 'local' }), { code: 'UNSAFE_URL' });
});

function rss(items) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Research</title>${items.join('')}</channel></rss>`;
}
function item({ title = 'Fresh laboratory report', url = 'https://example.org/story', date = 'Tue, 20 Oct 2026 08:00:00 GMT', summary = 'The laboratory reports a small prototype and states that independent replication remains pending.' } = {}) {
  return `<item><title>${title}</title><link>${url.replaceAll('&', '&amp;')}</link>${date === null ? '' : `<pubDate>${date}</pubDate>`}<description><![CDATA[${summary}]]></description></item>`;
}
function collectorFor(xml, { resolve = async () => ({}), fetches = [] } = {}) {
  return createSourceCollector({ request: async url => { fetches.push(url); return { status: 200, text: xml, url }; }, resolve });
}

test('RSS collection enforces publication dates, freshness and safe source links', async () => {
  const xml = rss([
    item(), item({ title: 'Old report', url: 'https://example.org/old', date: 'Tue, 13 Oct 2026 08:00:00 GMT' }),
    item({ title: 'Future report', url: 'https://example.org/future', date: 'Wed, 21 Oct 2026 08:00:00 GMT' }),
    item({ title: 'Undated report', url: 'https://example.org/undated', date: null }),
    item({ title: 'Private report', url: 'https://127.0.0.1/secret' }),
    item({ title: 'Empty report', url: 'https://example.org/empty', summary: '' }),
  ]);
  const fetches = [];
  const result = await collectorFor(xml, { fetches })([{ id: 'feed1', label: 'Research', url: 'https://example.org/feed', enabled: true }], { now: NOW });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].publishedAt, '2026-10-20T08:00:00.000Z');
  assert.equal(result.items[0].retrievedAt, NOW.toISOString());
  assert.match(result.errors[0].message, /1 without a usable date, 1 outside the freshness window, 1 after the cutoff, 1 unsafe links, 1 without/);
  assert.deepEqual(fetches, ['https://example.org/feed'], 'Full article pages are not retrieved.');
});

test('per-source freshness window can narrow the default 48 hours', async () => {
  const collect = collectorFor(rss([item({ date: 'Mon, 19 Oct 2026 00:00:00 GMT' })]));
  const source = { id: 'source', url: 'https://example.org/feed' };
  assert.equal((await collect([source], { now: NOW })).items.length, 1);
  assert.equal((await collect([{ ...source, freshnessHours: 24 }], { now: NOW })).items.length, 0);
});

test('deduplication covers tracking parameters, duplicate titles and previously seen URLs', async () => {
  const collect = collectorFor(rss([item({ url: 'https://example.org/story?utm_source=feed' }), item({ url: 'https://example.org/story' }), item({ url: 'https://example.org/mirror' }), item({ title: 'A separate item', url: 'https://example.org/new' })]));
  const source = [{ id: 'feed', url: 'https://example.org/feed' }];
  const first = await collect(source, { now: NOW });
  assert.equal(first.items.length, 2);
  const next = await collect(source, { now: NOW, seenUrls: new Set(['https://example.org/story?utm_medium=mail', 'https://example.org/mirror', 'https://example.org/new']) });
  assert.equal(next.items.length, 0);
  assert.equal(canonicalSourceUrl('https://example.org/story?a=1&utm_source=rss#top'), 'https://example.org/story?a=1');
});

test('Atom alternate links, namespace tags and summaries are read without full-page access', async () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Research Atom</title><entry><title>A fresh atom item</title><link rel="self" href="https://example.org/api/item"/><link rel="alternate" href="/article"/><published>2026-10-20T09:00:00Z</published><summary type="html">&lt;p&gt;A bounded research summary with an explicit limitation.&lt;/p&gt;</summary></entry></feed>`;
  const result = await collectorFor(xml)([{ id: 'atom', url: 'https://example.org/feed' }], { now: NOW });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].url, 'https://example.org/article');
  assert.equal(result.items[0].excerpt, 'A bounded research summary with an explicit limitation.');
});

test('malicious XML, DTD and entity expansion fail closed', async () => {
  for (const xml of [
    '<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel><title>&xxe;</title></channel></rss>',
    '<!DOCTYPE rss [<!ENTITY a "repeat">]><rss><channel><title>&a;</title></channel></rss>',
    '<rss><channel><title>bad',
    `${'<a>'.repeat(60)}${'</a>'.repeat(60)}`,
  ]) {
    const result = await collectorFor(xml)([{ id: 'bad', url: 'https://example.org/feed' }], { now: NOW });
    assert.equal(result.items.length, 0);
    assert.equal(result.errors.length, 1);
  }
});

test('feed markup and active content become bounded plain text', () => {
  const text = plainFeedText('<script>stealSecrets()</script><p>Report &amp; evidence</p><img src="file:///secret" onerror="run()">');
  assert.equal(text, 'Report & evidence');
  assert.equal(plainFeedText('x'.repeat(10_000), 50).length, 50);
});

test('pre-aborted collection performs no fetch', async () => {
  let fetched = false;
  const collect = createSourceCollector({ request: async () => { fetched = true; } });
  await assert.rejects(collect([{ url: 'https://example.org/feed' }], { signal: AbortSignal.abort() }), { name: 'AbortError' });
  assert.equal(fetched, false);
});
