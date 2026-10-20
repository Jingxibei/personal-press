import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeSettings, defaultSettings, assertIssueDate, assertTimeZone } from './settings.mjs';

const SETTINGS_LIMIT = 512 * 1024;
const META_LIMIT = 8 * 1024 * 1024;
const ISSUE_LIMIT = 16 * 1024 * 1024;
const NO_FOLLOW = constants.O_NOFOLLOW || 0;
const SECRET_KEY = /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passphrase|secret|client[_-]?secret|credentials?|authorization|private[_-]?key)$/iu;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PRINT_STATUSES = new Set(['submitting', 'submitted', 'uncertain', 'preflight_failed']);

function error(code, message, cause) {
  const result = new Error(message, cause ? { cause } : undefined);
  result.code = code;
  return result;
}

function jsonValue(value, depth = 0) {
  if (depth > 40) throw error('INVALID_DATA', 'Local data is nested too deeply.');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length > 20_000) throw error('INVALID_DATA', 'Local data contains too many entries.');
    return value.map(item => jsonValue(item, depth + 1));
  }
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw error('INVALID_DATA', 'Local data must contain only JSON values.');
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (DANGEROUS_KEYS.has(key) || SECRET_KEY.test(key)) throw error('INVALID_DATA', 'Secrets and unsafe fields cannot be stored in newspaper data.');
    result[key] = jsonValue(value[key], depth + 1);
  }
  return result;
}

function encode(value, limit) {
  const result = `${JSON.stringify(jsonValue(value), null, 2)}\n`;
  if (Buffer.byteLength(result, 'utf8') > limit) throw error('DATA_TOO_LARGE', 'The local record exceeds its size limit.');
  return result;
}

function iso(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/u.test(value) || !Number.isFinite(new Date(value).getTime())) throw error('INVALID_DATA', `The ${label} timestamp is invalid.`);
  return value;
}

function normalizeIssue(value) {
  const issue = jsonValue(value);
  if (!issue || Array.isArray(issue) || typeof issue !== 'object') throw error('INVALID_ISSUE', 'The issue must be an object.');
  assertIssueDate(issue.id);
  assertIssueDate(issue.date);
  if (issue.id !== issue.date) throw error('INVALID_ISSUE', 'The issue ID must match its calendar date.');
  if (issue.sample !== false) throw error('INVALID_ISSUE', 'A sample cannot occupy an official daily issue.');
  if (!['prepared', 'published'].includes(issue.status)) throw error('INVALID_ISSUE', 'The issue state is invalid.');
  if (typeof issue.title !== 'string' || !issue.title.trim() || issue.title.length > 200) throw error('INVALID_ISSUE', 'The issue title is invalid.');
  if (!Array.isArray(issue.articles) || issue.articles.length < 1 || issue.articles.length > 12 || issue.articles.some(article => !article || typeof article !== 'object' || Array.isArray(article))) throw error('INVALID_ISSUE', 'An official issue needs between 1 and 12 articles.');
  if (!Array.isArray(issue.sources) || issue.sources.length < 1 || issue.sources.length > 100) throw error('INVALID_ISSUE', 'An official issue needs bounded source references.');
  iso(issue.createdAt, 'creation');
  iso(issue.cutoffAt, 'cutoff');
  assertTimeZone(issue.timeZone);
  // Publication is mutable metadata; generated text and its prepared state are not.
  issue.status = 'prepared';
  encode(issue, ISSUE_LIMIT);
  return issue;
}

function defaultMeta() {
  return { version: 1, issueStates: {}, schedule: {}, printJobs: [] };
}

function normalizeMeta(value) {
  const meta = jsonValue(value);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta) || (meta.version !== undefined && meta.version !== 1)) throw error('INVALID_DATA', 'The local metadata format is invalid.');
  meta.version = 1;
  meta.issueStates ??= {};
  meta.schedule ??= {};
  meta.printJobs ??= [];
  if (!meta.issueStates || typeof meta.issueStates !== 'object' || Array.isArray(meta.issueStates) || !meta.schedule || typeof meta.schedule !== 'object' || Array.isArray(meta.schedule) || !Array.isArray(meta.printJobs) || meta.printJobs.length > 20_000) throw error('INVALID_DATA', 'The local metadata structure is invalid.');
  for (const [id, state] of Object.entries(meta.issueStates)) {
    assertIssueDate(id);
    if (!state || state.status !== 'published') throw error('INVALID_DATA', 'The publication metadata is invalid.');
    iso(state.publishedAt, 'publication');
  }
  const ids = new Set();
  for (const job of meta.printJobs) {
    if (!job || typeof job.id !== 'string' || job.id.length > 128 || ids.has(job.id) || !PRINT_STATUSES.has(job.status) || typeof job.issueId !== 'string') throw error('INVALID_DATA', 'The print job metadata is invalid.');
    if (!['test', 'sample'].includes(job.issueId)) assertIssueDate(job.issueId);
    iso(job.createdAt, 'print job');
    ids.add(job.id);
  }
  encode(meta, META_LIMIT);
  return meta;
}

function mergeMeta(current, input) {
  const result = normalizeMeta(input);
  // A stale caller must not unpublish an issue or erase a submitted/uncertain job.
  result.issueStates = { ...result.issueStates, ...current.issueStates };
  const incoming = new Map(result.printJobs.map(job => [job.id, job]));
  const merged = current.printJobs.map(previous => {
    const next = incoming.get(previous.id);
    incoming.delete(previous.id);
    if (!next) return previous;
    if (previous.status === 'submitted') return previous;
    if (previous.status === 'uncertain' && next.status !== 'submitted') return previous;
    if (previous.status === 'submitting' && next.status === 'preflight_failed') return previous;
    // The physical job identity cannot be rewritten by a metadata update.
    const value = { ...next };
    for (const key of ['id', 'issueId', 'deviceName', 'automatic', 'paperSize', 'duplex', 'copies', 'createdAt']) {
      if (Object.hasOwn(previous, key)) value[key] = previous[key];
    }
    return value;
  });
  result.printJobs = [...merged, ...incoming.values()];
  return normalizeMeta(result);
}

async function directory(value) {
  try {
    await fs.mkdir(value, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(value);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw error('UNSAFE_PATH', 'The data location must be a real directory.');
    await fs.chmod(value, 0o700);
    return await fs.realpath(value);
  } catch (cause) {
    if (cause.code === 'UNSAFE_PATH') throw cause;
    throw error('STORE_IO', 'The local data directory could not be opened.', cause);
  }
}

async function readJson(filename, limit, fallback) {
  let handle;
  try {
    const stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw error('UNSAFE_PATH', 'A local data file is unsafe or too large.');
    handle = await fs.open(filename, constants.O_RDONLY | NO_FOLLOW);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > limit) throw error('UNSAFE_PATH', 'A local data file is unsafe or too large.');
    const data = await handle.readFile({ encoding: 'utf8' });
    if (Buffer.byteLength(data) > limit) throw error('DATA_TOO_LARGE', 'A local data file exceeds its size limit.');
    try { return JSON.parse(data); }
    catch (cause) { throw error('CORRUPT_DATA', 'A local data file could not be read. Restore it from a backup before continuing.', cause); }
  } catch (cause) {
    if (cause.code === 'ENOENT') return fallback;
    if (['UNSAFE_PATH', 'DATA_TOO_LARGE', 'CORRUPT_DATA'].includes(cause.code)) throw cause;
    throw error('STORE_IO', 'The local data file could not be read.', cause);
  } finally { await handle?.close(); }
}

async function syncDirectory(value) {
  let handle;
  try {
    handle = await fs.open(value, constants.O_RDONLY | (constants.O_DIRECTORY || 0));
    await handle.sync();
  } catch (cause) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EBADF', 'EPERM', 'EACCES'].includes(cause.code)) throw cause;
  } finally { await handle?.close(); }
}

async function writeAtomic(filename, value, limit, { first = false } = {}) {
  const data = encode(value, limit);
  const folder = path.dirname(filename);
  const temporary = path.join(folder, `.write-${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NO_FOLLOW, 0o600);
    await handle.writeFile(data, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    if (first) {
      // link() publishes a complete file atomically and cannot replace an existing ID.
      // Never fall back to overwrite-rename if the filesystem lacks hard links.
      await fs.link(temporary, filename);
    } else {
      try {
        const previous = await fs.lstat(filename);
        if (!previous.isFile() || previous.isSymbolicLink()) throw error('UNSAFE_PATH', 'A local data file has an unsafe path.');
      } catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
      await fs.rename(temporary, filename);
    }
    await syncDirectory(folder);
  } catch (cause) {
    if (first && cause.code === 'EEXIST') throw cause;
    if (cause.code === 'UNSAFE_PATH') throw cause;
    throw error('STORE_IO', 'The local record could not be saved safely.', cause);
  } finally {
    await handle?.close();
    try { await fs.unlink(temporary); } catch (cause) { if (cause.code !== 'ENOENT') throw error('STORE_IO', 'A temporary local record could not be removed.', cause); }
  }
}

/** Local files only. One main-process executor owns settings and metadata updates. */
export async function createStore(location) {
  if (typeof location !== 'string' || !location || location.includes('\0') || !path.isAbsolute(location)) throw error('UNSAFE_PATH', 'An absolute local data directory is required.');
  const root = await directory(path.resolve(location));
  const issuesDirectory = await directory(path.join(root, 'issues'));
  const settingsFile = path.join(root, 'settings.json');
  const metaFile = path.join(root, 'meta.json');
  const issueFile = id => path.join(issuesDirectory, `${assertIssueDate(id)}.json`);
  for (const [filename, value, limit] of [[settingsFile, defaultSettings(), SETTINGS_LIMIT], [metaFile, defaultMeta(), META_LIMIT]]) {
    try { await writeAtomic(filename, value, limit, { first: true }); }
    catch (cause) { if (cause.code !== 'EEXIST') throw cause; }
  }

  let pending = Promise.resolve();
  const serial = task => {
    const result = pending.then(task);
    pending = result.catch(() => {});
    return result;
  };
  const readSettings = async () => {
    const saved = await readJson(settingsFile, SETTINGS_LIMIT, null);
    if (saved === null) throw error('MISSING_DATA', 'The saved settings are missing. Restore the local data before continuing.');
    return normalizeSettings(saved);
  };
  const readMeta = async () => {
    const saved = await readJson(metaFile, META_LIMIT, null);
    if (saved === null) throw error('MISSING_DATA', 'The publishing and print history is missing. Restore the local data before continuing.');
    return normalizeMeta(saved);
  };
  const readIssue = async id => {
    const raw = await readJson(issueFile(id), ISSUE_LIMIT, null);
    if (raw === null) return null;
    const result = normalizeIssue(raw);
    if (result.id !== id) throw error('INVALID_ISSUE', 'The saved issue does not match its date.');
    return result;
  };
  const withState = (issue, meta) => issue ? { ...issue, status: meta.issueStates[issue.id]?.status === 'published' ? 'published' : 'prepared' } : null;
  // Fail closed on corrupt existing settings or metadata; never silently reset state.
  await readSettings();
  await readMeta();

  return {
    getSettings: () => serial(readSettings),
    saveSettings: input => serial(async () => {
      const result = normalizeSettings(input);
      await writeAtomic(settingsFile, result, SETTINGS_LIMIT);
      return result;
    }),
    getMeta: () => serial(readMeta),
    saveMeta: input => serial(async () => {
      const result = mergeMeta(await readMeta(), input);
      await writeAtomic(metaFile, result, META_LIMIT);
      return result;
    }),
    // The updater runs under this store's queue; do not call store methods inside it.
    updateMeta: updater => serial(async () => {
      if (typeof updater !== 'function') throw new TypeError('A metadata updater function is required.');
      const current = await readMeta();
      const draft = structuredClone(current);
      const returned = await updater(draft);
      const result = mergeMeta(current, returned === undefined ? draft : returned);
      await writeAtomic(metaFile, result, META_LIMIT);
      return result;
    }),
    getIssue: id => serial(async () => withState(await readIssue(id), await readMeta())),
    saveIssue: input => serial(async () => {
      const issue = normalizeIssue(input);
      try { await writeAtomic(issueFile(issue.id), issue, ISSUE_LIMIT, { first: true }); }
      catch (cause) {
        if (cause.code !== 'EEXIST') throw cause;
        const existing = await readIssue(issue.id);
        if (!existing || encode(existing, ISSUE_LIMIT) !== encode(issue, ISSUE_LIMIT)) throw error('ISSUE_EXISTS', 'This date already has an official issue. Its generated content cannot be replaced.');
      }
      return withState(issue, await readMeta());
    }),
    publishIssue: id => serial(async () => {
      const issue = await readIssue(id);
      if (!issue) throw error('ISSUE_NOT_FOUND', 'The requested issue does not exist.');
      const meta = await readMeta();
      if (!meta.issueStates[id]) {
        meta.issueStates[id] = { status: 'published', publishedAt: new Date().toISOString() };
        await writeAtomic(metaFile, meta, META_LIMIT);
      }
      return withState(issue, meta);
    }),
    listIssues: () => serial(async () => {
      let names;
      try { names = await fs.readdir(issuesDirectory); }
      catch (cause) { throw error('STORE_IO', 'The local issue history could not be read.', cause); }
      const meta = await readMeta();
      const ids = names.filter(name => /^\d{4}-\d{2}-\d{2}\.json$/u.test(name)).map(name => name.slice(0, -5)).sort().reverse();
      const entries = [];
      for (const id of ids) {
        const issue = withState(await readIssue(id), meta);
        if (!issue) continue;
        const printJob = meta.printJobs.findLast(job => job.issueId === id);
        entries.push({
          id, date: issue.date, title: issue.title, status: issue.status,
          createdAt: issue.createdAt, articleCount: issue.articles.length,
          printStatus: printJob?.status ?? 'none',
        });
      }
      return entries;
    }),
  };
}
