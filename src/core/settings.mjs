import { isIP } from 'node:net';

const LANGUAGES = ['zh-CN', 'en', 'ja'];
const PROVIDERS = ['openai', 'gemini', 'grok', 'deepseek', 'local'];
const PROVIDER_HOSTS = {
  openai: 'api.openai.com', gemini: 'generativelanguage.googleapis.com',
  grok: 'api.x.ai', deepseek: 'api.deepseek.com',
};
const ROOT_KEYS = ['version', 'uiLanguage', 'publication', 'profile', 'sources', 'model', 'reading', 'print', 'entertainment', 'calendar'];

function fail(label, detail = 'is invalid') {
  throw new TypeError(`Settings: ${label} ${detail}.`);
}

function object(value, keys, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(label, 'must be an object');
  if (Object.keys(value).some(key => !keys.includes(key))) fail(label, 'contains an unsupported field');
  return value;
}

function string(value, fallback, max, label, { empty = true, multiline = false } = {}) {
  if (value === undefined) {
    if (fallback === undefined) fail(label, 'is required');
    return fallback;
  }
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u).test(value)) fail(label, 'must be bounded plain text');
  return value;
}

function integer(value, fallback, min, max, label) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) fail(label, `must be an integer from ${min} to ${max}`);
  return value;
}

function boolean(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') fail(label, 'must be true or false');
  return value;
}

function choice(value, fallback, options, label) {
  if (value === undefined) return fallback;
  if (!options.includes(value)) fail(label, 'has an unsupported value');
  return value;
}

function array(value, max, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) fail(label, `must contain at most ${max} items`);
  return value;
}

function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/u.test(value)) fail(label, 'must be a stable identifier');
  return value;
}

function unique(items, key, label) {
  const keys = items.map(key);
  if (new Set(keys).size !== keys.length) fail(label, 'contains duplicate identifiers');
  return items;
}

export function assertTimeZone(value) {
  if (typeof value !== 'string' || value.length > 100 || !/^[A-Za-z][A-Za-z0-9_+./-]*$/u.test(value)) fail('time zone', 'must be an IANA time zone');
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); }
  catch { fail('time zone', 'must be an available IANA time zone'); }
  return value;
}

export function assertLocalTime(value) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value)) fail('time', 'must use HH:mm');
  return value;
}

export function assertIssueDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value) || value.startsWith('0000')) fail('date', 'must use a real YYYY-MM-DD date');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('date', 'must be a real calendar date');
  return value;
}

function isLoopback(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  return host === 'localhost' || host === '::1' || (isIP(host) === 4 && Number(host.split('.')[0]) === 127);
}

function sourceUrl(value) {
  string(value, '', 2048, 'source URL', { empty: false });
  let url;
  try { url = new URL(value); } catch { fail('source URL', 'must be an absolute public HTTPS URL'); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '').replace(/\.$/u, '');
  // Network retrieval additionally resolves DNS and validates every redirect.
  // Literal addresses and local-only names have no place in the public-feed setting.
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !host.includes('.') || isIP(host) || isLoopback(host) || /(?:^|\.)(?:localhost|local|internal|lan|home|onion)$/u.test(host)) fail('source URL', 'must be a public HTTPS URL without credentials or a fragment');
  return url.href;
}

function baseUrl(value, provider) {
  if (value === undefined || value === '') return '';
  string(value, '', 2048, 'model base URL', { empty: false });
  let url;
  try { url = new URL(value); } catch { fail('model base URL'); }
  if (url.username || url.password || url.search || url.hash) fail('model base URL', 'must not contain credentials, a query or a fragment');
  if (provider === 'local') {
    if (!['http:', 'https:'].includes(url.protocol) || !isLoopback(url.hostname)) fail('local model base URL', 'must use a loopback address');
  } else if (url.protocol !== 'https:' || url.hostname !== PROVIDER_HOSTS[provider] || (url.port && url.port !== '443')) {
    fail('model base URL', 'must use the selected provider’s official HTTPS endpoint');
  }
  return url.href.replace(/\/$/u, '');
}

export function defaultSettings(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') {
  assertTimeZone(timeZone);
  return {
    version: 1,
    uiLanguage: 'zh-CN',
    publication: { title: 'The Personal Press', time: '07:00', timeZone, enabled: false },
    profile: { tracks: [], lenses: [], custom: '', depth: 3 },
    sources: [],
    model: { provider: 'openai', model: '', baseUrl: '', maxArticles: 6, review: true },
    reading: { languageA: 'en', languageB: 'zh-CN', ratio: 70, fontSize: 17, palette: 'ink', layout: 'newspaper' },
    print: { enabled: false, deviceName: '', paperSize: 'A4', duplex: 'simplex', maxPages: 12, includeLeisure: true },
    entertainment: { enabled: true, sudoku: true, crossword: true, riddle: true, joke: true },
    calendar: { events: [] },
  };
}

/** Whitelist every persisted setting. Secrets use the main-process credential store. */
export function normalizeSettings(input = {}) {
  const data = object(input, ROOT_KEYS, 'settings');
  choice(data.version, 1, [1], 'version');
  const defaults = defaultSettings();
  const publication = object(data.publication, ['title', 'time', 'timeZone', 'enabled'], 'publication');
  const profile = object(data.profile, ['tracks', 'lenses', 'custom', 'depth'], 'profile');
  const model = object(data.model, ['provider', 'model', 'baseUrl', 'maxArticles', 'review'], 'model');
  const reading = object(data.reading, ['languageA', 'languageB', 'ratio', 'fontSize', 'palette', 'layout'], 'reading');
  const print = object(data.print, ['enabled', 'deviceName', 'paperSize', 'duplex', 'maxPages', 'includeLeisure'], 'print');
  const entertainment = object(data.entertainment, ['enabled', 'sudoku', 'crossword', 'riddle', 'joke'], 'entertainment');
  const calendar = object(data.calendar, ['events'], 'calendar');
  const provider = choice(model.provider, 'openai', PROVIDERS, 'model provider');
  const tracks = unique(array(profile.tracks, 24, 'tracks').map((value) => {
    const track = object(value, ['id', 'domain', 'branch', 'topics', 'custom', 'depth'], 'track');
    return {
      id: identifier(track.id, 'track ID'),
      domain: identifier(track.domain, 'track domain'),
      branch: track.branch === '' || track.branch === undefined ? '' : identifier(track.branch, 'track branch'),
      topics: unique(array(track.topics, 24, 'track topics').map(topic => string(topic, undefined, 200, 'topic', { empty: false })), topic => topic, 'track topics'),
      custom: string(track.custom, '', 2000, 'track custom description', { multiline: true }),
      depth: track.depth === null || track.depth === undefined ? null : integer(track.depth, 3, 1, 5, 'track depth'),
    };
  }), track => track.id, 'tracks');
  const sources = unique(array(data.sources, 50, 'sources').map(value => {
    const source = object(value, ['id', 'label', 'url', 'enabled', 'freshnessHours'], 'source');
    return {
      id: identifier(source.id, 'source ID'),
      label: string(source.label, '', 200, 'source label'),
      url: sourceUrl(source.url),
      enabled: boolean(source.enabled, true, 'source enabled'),
      freshnessHours: integer(source.freshnessHours, 48, 1, 168, 'source freshness hours'),
    };
  }), source => source.id, 'sources');
  const events = unique(array(calendar.events, 500, 'calendar events').map(value => {
    const event = object(value, ['id', 'date', 'time', 'title'], 'calendar event');
    return {
      id: identifier(event.id, 'event ID'), date: assertIssueDate(event.date),
      time: event.time === '' || event.time === undefined ? '' : assertLocalTime(event.time),
      title: string(event.title, undefined, 250, 'event title', { empty: false }),
    };
  }), event => event.id, 'calendar events');
  return {
    version: 1,
    uiLanguage: choice(data.uiLanguage, 'zh-CN', LANGUAGES, 'interface language'),
    publication: {
      title: string(publication.title, defaults.publication.title, 120, 'publication title', { empty: false }),
      time: assertLocalTime(publication.time === undefined ? defaults.publication.time : publication.time),
      timeZone: assertTimeZone(publication.timeZone === undefined ? defaults.publication.timeZone : publication.timeZone),
      enabled: boolean(publication.enabled, false, 'publication enabled'),
    },
    profile: {
      tracks,
      lenses: unique(array(profile.lenses, 24, 'lenses').map(lens => identifier(lens, 'lens')), lens => lens, 'lenses'),
      custom: string(profile.custom, '', 4000, 'profile custom description', { multiline: true }),
      depth: integer(profile.depth, 3, 1, 5, 'profile depth'),
    },
    sources,
    model: {
      provider, model: string(model.model, '', 160, 'model ID'), baseUrl: baseUrl(model.baseUrl, provider),
      maxArticles: integer(model.maxArticles, 6, 1, 12, 'maximum articles'),
      review: boolean(model.review, true, 'model review'),
    },
    reading: {
      languageA: choice(reading.languageA, 'en', LANGUAGES, 'first reading language'),
      languageB: choice(reading.languageB, 'zh-CN', LANGUAGES, 'second reading language'),
      ratio: integer(reading.ratio, 70, 0, 100, 'language ratio'),
      fontSize: integer(reading.fontSize, 17, 12, 28, 'font size'),
      palette: choice(reading.palette, 'ink', ['ink', 'warm', 'aged', 'gray'], 'paper palette'),
      layout: choice(reading.layout, 'newspaper', ['newspaper', 'focus'], 'reading layout'),
    },
    print: {
      enabled: boolean(print.enabled, false, 'automatic printing'),
      deviceName: string(print.deviceName, '', 256, 'printer device name'),
      paperSize: choice(print.paperSize, 'A4', ['A4', 'Letter', 'A3'], 'paper size'),
      duplex: choice(print.duplex, 'simplex', ['simplex', 'longEdge', 'shortEdge'], 'duplex mode'),
      maxPages: integer(print.maxPages, 12, 1, 12, 'automatic print page limit'),
      includeLeisure: boolean(print.includeLeisure, true, 'include leisure'),
    },
    entertainment: Object.fromEntries(['enabled', 'sudoku', 'crossword', 'riddle', 'joke'].map(key => [key, boolean(entertainment[key], true, `entertainment ${key}`)])),
    calendar: { events },
  };
}
