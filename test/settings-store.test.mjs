import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defaultSettings, normalizeSettings } from '../src/core/settings.mjs';
import { createStore } from '../src/core/store.mjs';
import { reserveAutoPrint, markPrintSubmitted, recoverPrintJobs } from '../src/core/print-ledger.mjs';

function issue(date = '2026-10-20', title = 'Original issue') {
  return {
    id: date, date, title, createdAt: `${date}T06:45:00.000Z`, cutoffAt: `${date}T06:40:00.000Z`,
    timeZone: 'UTC', languageA: 'en', languageB: 'zh-CN', ratio: 70, status: 'prepared', sample: false,
    articles: [{ id: 'a1', titleA: 'A source-based article', sourceIds: ['s1'] }],
    sources: [{ id: 's1', url: 'https://example.org/source', title: 'A public source' }],
    review: { status: 'checked', notes: [] }, entertainment: {}, calendar: [], model: { provider: 'local', name: 'test-model' },
  };
}

async function temporary(t) {
  const location = await fs.mkdtemp(path.join(os.tmpdir(), 'personal-press-core-'));
  t.after(() => fs.rm(location, { recursive: true, force: true }));
  return location;
}

test('settings whitelist preserves bounded professional tracks, languages and freshness without credentials', () => {
  const data = defaultSettings('Asia/Tokyo');
  assert.equal(data.publication.enabled, false);
  assert.equal(data.print.enabled, false);
  assert.deepEqual(data.sources, []);
  data.profile.tracks = [{ id: 'work', domain: 'manufacturing', branch: 'quality', topics: ['Process control'], custom: 'My production workflow', depth: 4 }];
  data.profile.lenses = ['regulation'];
  data.sources = [{ id: 'public', label: 'Public feed', url: 'https://example.org/feed.xml', enabled: true }];
  data.reading.languageA = 'ja';
  data.reading.languageB = 'en';
  data.reading.layout = 'focus';
  const normalized = normalizeSettings(data);
  assert.deepEqual(normalized.profile.tracks, data.profile.tracks);
  assert.equal(normalized.sources[0].freshnessHours, 48);
  assert.equal(normalized.reading.layout, 'focus');
  normalized.profile.tracks[0].topics.push('Independent copy');
  assert.equal(data.profile.tracks[0].topics.length, 1);
  for (const input of [
    { apiKey: 'test-only-never-a-real-key' },
    { model: { apiKey: 'test-only-never-a-real-key' } },
    { print: { copies: 2 } }, { print: { maxPages: 13 } },
    { reading: { ratio: 101 } }, { profile: { depth: 0 } },
    { publication: { time: '25:00' } }, { publication: { time: null } },
    { publication: { timeZone: '+08:00' } }, { publication: { timeZone: null } },
    { model: { provider: 'local', baseUrl: 'http://example.org:11434/v1' } },
    { model: { provider: 'openai', baseUrl: 'https://api.openai.com.evil.example/v1' } },
    { sources: [{ id: 'x', url: 'https://127.0.0.1/rss' }] },
    { sources: [{ id: 'x', url: 'https://example.org/rss', freshnessHours: 169 }] },
    { calendar: { events: [{ id: 'x', date: '2026-02-30', time: '07:00', title: 'Invalid day' }] } },
    JSON.parse('{"__proto__":{"publication":{"enabled":true}}}'),
  ]) assert.throws(() => normalizeSettings(input));
  assert.equal(normalizeSettings({ model: { provider: 'local', baseUrl: 'http://127.0.0.1:11434/v1' } }).model.baseUrl, 'http://127.0.0.1:11434/v1');
});

test('first-write issue publication is race-safe across store instances and survives restart', async t => {
  const location = await temporary(t);
  const [a, b] = await Promise.all([createStore(location), createStore(location)]);
  const candidates = [issue(), issue('2026-10-20', 'Competing content')];
  const results = await Promise.allSettled([a.saveIssue(candidates[0]), b.saveIssue(candidates[1])]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'ISSUE_EXISTS');
  const saved = await a.getIssue('2026-10-20');
  const filename = path.join(location, 'issues', '2026-10-20.json');
  const before = await fs.readFile(filename, 'utf8');
  assert.deepEqual(await b.saveIssue(saved), saved);
  const restarted = await createStore(location);
  assert.deepEqual(await restarted.getIssue(saved.id), saved);
  const published = await restarted.publishIssue(saved.id);
  assert.equal(published.status, 'published');
  assert.equal(await fs.readFile(filename, 'utf8'), before);
  assert.equal((await a.getIssue(saved.id)).status, 'published');
  assert.equal((await a.listIssues())[0].status, 'published');
  await a.saveMeta({ version: 1, issueStates: {}, schedule: {}, printJobs: [] });
  assert.equal((await a.getIssue(saved.id)).status, 'published');
  assert.equal(await a.getIssue('2026-10-19'), null);
  if (process.platform !== 'win32') {
    assert.equal((await fs.stat(location)).mode & 0o777, 0o700);
    assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
  }
});

test('concurrent identical saves are idempotent and sample content cannot consume a date', async t => {
  const location = await temporary(t);
  const store = await createStore(location);
  const original = issue();
  const copies = await Promise.all(Array.from({ length: 8 }, () => store.saveIssue(original)));
  copies.forEach(copy => assert.deepEqual(copy, original));
  assert.equal((await store.listIssues()).length, 1);
  assert.equal((await store.listIssues())[0].status, 'prepared');
  await assert.rejects(store.saveIssue({ ...issue('2026-10-21'), sample: true }));
  assert.equal(await store.getIssue('2026-10-21'), null);
});

test('atomic metadata updates preserve print submission barriers across stale writes and restart', async t => {
  const location = await temporary(t);
  const store = await createStore(location);
  await Promise.all(Array.from({ length: 15 }, () => store.updateMeta(meta => { meta.counter = (meta.counter ?? 0) + 1; })));
  assert.equal((await store.getMeta()).counter, 15);
  const stale = await store.getMeta();
  const reserved = reserveAutoPrint([], { id: 'print-1', issueId: '2026-10-20', deviceName: 'Chosen printer', now: '2026-10-20T07:00:00Z' });
  await store.updateMeta(meta => { meta.printJobs = reserved.jobs; });
  const restarted = await createStore(location);
  await restarted.updateMeta(meta => { meta.printJobs = recoverPrintJobs(meta.printJobs, '2026-10-20T07:01:00Z'); });
  await restarted.saveMeta(stale);
  assert.equal((await restarted.getMeta()).printJobs[0].status, 'uncertain');
  await restarted.updateMeta(meta => { meta.printJobs = markPrintSubmitted(meta.printJobs, 'print-1', '2026-10-20T07:02:00Z'); });
  await restarted.saveMeta(stale);
  assert.equal((await restarted.getMeta()).printJobs[0].status, 'submitted');
  await assert.rejects(store.saveMeta({ credentials: { key: 'test-only-value' } }), /Secrets/u);
  await assert.rejects(store.saveSettings({ model: { apiKey: 'test-only-value' } }));
});

test('invalid dates, traversal and symlink targets are rejected without touching unrelated files', async t => {
  const location = await temporary(t);
  const store = await createStore(location);
  for (const id of ['../settings', '../../other', '/etc/passwd', '2026-02-30', 'sample', '2026-10-20/extra']) {
    await assert.rejects(store.getIssue(id));
    await assert.rejects(store.publishIssue(id));
  }
  await assert.rejects(createStore('relative-data'));
  const outside = path.join(location, 'unrelated.json');
  await fs.writeFile(outside, '{"unchanged":true}', { mode: 0o600 });
  try { await fs.symlink(outside, path.join(location, 'issues', '2026-10-20.json')); }
  catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') return; throw error; }
  await assert.rejects(store.getIssue('2026-10-20'));
  await assert.rejects(store.saveIssue(issue()));
  assert.equal(await fs.readFile(outside, 'utf8'), '{"unchanged":true}');
});
