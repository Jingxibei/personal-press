import { assertIssueDate, assertLocalTime, assertTimeZone } from './settings.mjs';

export const PREPARATION_MS = 20 * 60 * 1000;
const formatters = new Map();
const resolutions = new Map();

function timestamp(value) {
  const result = new Date(value).getTime();
  if (!Number.isFinite(result)) throw new TypeError('Schedule: a valid timestamp is required.');
  return result;
}

function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    assertTimeZone(timeZone);
    formatters.set(timeZone, new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }));
  }
  return formatters.get(timeZone);
}

function parts(value, timeZone) {
  return Object.fromEntries(formatter(timeZone).formatToParts(value).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function wallTime({ year, month, day, hour = 0, minute = 0, second = 0 }, millisecond = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return date.getTime();
}

function wallAt(value, timeZone) {
  return wallTime(parts(value, timeZone), ((value % 1000) + 1000) % 1000);
}

export function localDay(now, timeZone) {
  const value = parts(timestamp(now), timeZone);
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function addDay(day, count = 1) {
  assertIssueDate(day);
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return assertIssueDate(date.toISOString().slice(0, 10));
}

/** Resolve a civil time: first occurrence of a fold; first valid instant after a gap. */
export function resolveLocalTime(day, time, timeZone) {
  assertIssueDate(day);
  assertLocalTime(time);
  assertTimeZone(timeZone);
  const key = `${timeZone}|${day}|${time}`;
  if (resolutions.has(key)) return new Date(resolutions.get(key));
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = wallTime({ year, month, day: date, hour, minute });
  const offsets = new Set();
  // Sampling both sides of transitions also covers non-hour and date-line changes.
  for (let delta = -72; delta <= 72; delta += 6) {
    const probe = target + delta * 60 * 60 * 1000;
    offsets.add(wallAt(probe, timeZone) - probe);
  }
  const exact = [...offsets].map(offset => target - offset).filter(candidate => wallAt(candidate, timeZone) === target);
  let result;
  if (exact.length) {
    result = Math.min(...exact);
  } else {
    // This exceptional path runs only for a nonexistent civil time and is cached.
    // Locate the jump, then its precise boundary; do not shift 02:30 to 03:30.
    const start = target - 72 * 60 * 60 * 1000;
    const end = target + 72 * 60 * 60 * 1000;
    let previous = start;
    for (let probe = start + 60_000; probe <= end; probe += 60_000) {
      if (wallAt(probe, timeZone) >= target) {
        let low = previous;
        let high = probe;
        while (high - low > 1) {
          const middle = Math.floor((low + high) / 2);
          if (wallAt(middle, timeZone) >= target) high = middle;
          else low = middle;
        }
        result = high;
        break;
      }
      previous = probe;
    }
    if (result === undefined) throw new Error('Schedule: this local delivery time cannot be resolved.');
  }
  if (resolutions.size >= 1024) resolutions.delete(resolutions.keys().next().value);
  resolutions.set(key, result);
  return new Date(result);
}

function publicationFields(publication) {
  if (!publication || typeof publication !== 'object') throw new TypeError('Schedule: publication settings are required.');
  assertTimeZone(publication.timeZone);
  assertLocalTime(publication.time);
  if (typeof publication.enabled !== 'boolean') throw new TypeError('Schedule: enabled must be a boolean.');
  return publication;
}

export function publicationSignature(publication) {
  const value = publicationFields(publication);
  return `${value.timeZone}|${value.time}|${value.enabled ? 'on' : 'off'}`;
}

/** Next enabled delivery at or after now. Calendar arithmetic never adds 24 hours. */
export function nextDelivery(now, publication) {
  publicationFields(publication);
  if (!publication.enabled) return null;
  const value = timestamp(now);
  const today = localDay(value, publication.timeZone);
  const delivery = resolveLocalTime(today, publication.time, publication.timeZone);
  return delivery.getTime() >= value ? delivery : resolveLocalTime(addDay(today), publication.time, publication.timeZone);
}

function issueFor(issues, date) {
  if (!Array.isArray(issues)) throw new TypeError('Schedule: issue history must be an array.');
  return issues.find(issue => issue && issue.sample !== true && (issue.date === date || issue.id === date));
}

function changeGuard(meta, now) {
  const guard = meta?.schedule?.changeGuard;
  if (guard === undefined || guard === null) return null;
  if (!guard || guard.version !== 1 || !Array.isArray(guard.blockedDates) || guard.blockedDates.length > 16) throw new TypeError('Schedule: invalid change guard.');
  guard.blockedDates.forEach(assertIssueDate);
  return timestamp(guard.until) > timestamp(now) ? guard : null;
}

/** Main must use this for manual generation as well as scheduled preparation. */
export function canCreateIssue({ date, now, publication, issues = [], meta = {} }) {
  assertIssueDate(date);
  publicationFields(publication);
  if (issueFor(issues, date)) return false;
  const guard = changeGuard(meta, now);
  return !guard || !guard.blockedDates.includes(date);
}

/**
 * Build before changing settings, while holding the main generation/settings mutex.
 * Persist this guard FIRST, then save settings. A crash between those writes can
 * conservatively defer an issue, but cannot reset a daily slot. No global quota is
 * implied: existing immutable date IDs remain the permanent uniqueness boundary.
 */
export function createScheduleGuard({ now, previousPublication, publication, issues = [], meta = {} }) {
  const value = timestamp(now);
  publicationFields(previousPublication);
  publicationFields(publication);
  const previous = changeGuard(meta, value);
  if (previousPublication.timeZone === publication.timeZone) return previous ? { ...previous, blockedDates: [...previous.blockedDates] } : null;
  const oldToday = localDay(value, previousPublication.timeZone);
  const newToday = localDay(value, publication.timeZone);
  if (!previous && !issueFor(issues, oldToday) && !issueFor(issues, newToday)) return null;
  const tomorrow = addDay(newToday);
  const midnight = resolveLocalTime(tomorrow, '00:00', publication.timeZone).getTime();
  const blockedDates = new Set([...(previous?.blockedDates ?? []), oldToday, newToday]);
  const tomorrowDelivery = resolveLocalTime(tomorrow, publication.time, publication.timeZone).getTime();
  // A zone change during a new 00:05 preparation window must not open a new slot.
  if (value >= tomorrowDelivery - PREPARATION_MS && value < tomorrowDelivery) blockedDates.add(tomorrow);
  return {
    version: 1, changedAt: new Date(value).toISOString(),
    until: new Date(Math.max(midnight, previous ? timestamp(previous.until) : 0)).toISOString(),
    blockedDates: [...blockedDates].sort(),
    previousSignature: publicationSignature(previousPublication),
    signature: publicationSignature(publication),
  };
}

/** scheduledAt is an ISO timestamp; only today or the imminent next day is eligible. */
export function getScheduleDecision({ now, settings, issues = [], meta = {} }) {
  const publication = publicationFields(settings?.publication);
  const value = timestamp(now);
  const today = localDay(value, publication.timeZone);
  const none = { date: today, action: 'none' };
  if (!publication.enabled) return none;
  const choose = (date) => {
    const scheduledAt = resolveLocalTime(date, publication.time, publication.timeZone);
    const scheduled = scheduledAt.getTime();
    const existing = issueFor(issues, date);
    const published = existing?.status === 'published' || meta?.issueStates?.[date]?.status === 'published';
    if (existing && value >= scheduled && !published) return { date, action: 'publish', scheduledAt: scheduledAt.toISOString() };
    if (!existing && value >= scheduled - PREPARATION_MS && canCreateIssue({ date, now: value, publication, issues, meta })) return { date, action: 'prepare', scheduledAt: scheduledAt.toISOString() };
    return null;
  };
  const current = choose(today);
  if (current) return current;
  // Handles 00:00–00:19 delivery preparation on the preceding calendar day.
  const tomorrow = addDay(today);
  const tomorrowDelivery = resolveLocalTime(tomorrow, publication.time, publication.timeZone).getTime();
  if (value < tomorrowDelivery && value >= tomorrowDelivery - PREPARATION_MS) return choose(tomorrow) ?? none;
  return none;
}
