import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../src/core/settings.mjs';
import { localDay, resolveLocalTime, nextDelivery, getScheduleDecision, createScheduleGuard, canCreateIssue } from '../src/core/schedule.mjs';

function settings(time = '07:00', timeZone = 'UTC') {
  const result = defaultSettings(timeZone);
  result.publication = { ...result.publication, time, enabled: true };
  return result;
}

const published = date => ({ id: date, date, status: 'published' });
const prepared = date => ({ id: date, date, status: 'prepared' });

test('civil dates use the selected IANA timezone, independently of the host timezone', () => {
  assert.equal(localDay('2026-10-20T23:30:00Z', 'Asia/Tokyo'), '2026-10-21');
  assert.equal(localDay('2026-10-20T23:30:00Z', 'America/Los_Angeles'), '2026-10-20');
  assert.throws(() => localDay('invalid', 'UTC'));
});

test('DST gaps resolve to the first valid instant and folds to their first occurrence', () => {
  assert.equal(resolveLocalTime('2026-03-08', '02:30', 'America/New_York').toISOString(), '2026-03-08T07:00:00.000Z');
  assert.equal(resolveLocalTime('2026-11-01', '01:30', 'America/New_York').toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal(resolveLocalTime('2026-10-04', '02:15', 'Australia/Lord_Howe').toISOString(), '2026-10-03T15:30:00.000Z');
  assert.equal(resolveLocalTime('2011-12-30', '07:00', 'Pacific/Apia').toISOString(), '2011-12-30T10:00:00.000Z');
  const result = resolveLocalTime('2026-11-01', '01:30', 'America/New_York');
  result.setTime(0);
  assert.equal(resolveLocalTime('2026-11-01', '01:30', 'America/New_York').toISOString(), '2026-11-01T05:30:00.000Z');
});

test('next delivery advances calendar days across DST, and disabled scheduling stays disabled', () => {
  const value = settings('07:00', 'America/New_York');
  assert.equal(nextDelivery('2026-03-07T13:00:00Z', value.publication).toISOString(), '2026-03-08T11:00:00.000Z');
  assert.equal(nextDelivery('2026-03-08T11:00:00Z', value.publication).toISOString(), '2026-03-08T11:00:00.000Z');
  value.publication.enabled = false;
  assert.equal(nextDelivery('2026-03-08T11:00:00Z', value.publication), null);
});

test('the 20-minute preparation window crosses midnight for a 00:05 delivery', () => {
  const value = settings('00:05');
  const issues = [published('2026-10-20')];
  assert.equal(getScheduleDecision({ now: '2026-10-20T23:44:59Z', settings: value, issues }).action, 'none');
  assert.deepEqual(getScheduleDecision({ now: '2026-10-20T23:45:00Z', settings: value, issues }), {
    date: '2026-10-21', action: 'prepare', scheduledAt: '2026-10-21T00:05:00.000Z',
  });
  issues.push(prepared('2026-10-21'));
  assert.equal(getScheduleDecision({ now: '2026-10-20T23:59:00Z', settings: value, issues }).action, 'none');
  assert.equal(getScheduleDecision({ now: '2026-10-21T00:04:59Z', settings: value, issues }).action, 'none');
  assert.deepEqual(getScheduleDecision({ now: '2026-10-21T00:05:00Z', settings: value, issues }), {
    date: '2026-10-21', action: 'publish', scheduledAt: '2026-10-21T00:05:00.000Z',
  });
});

test('late startup prepares today only; a manual issue and a scheduled issue use the same date', () => {
  const value = settings();
  const now = '2026-10-22T14:00:00Z';
  const issues = [prepared('2026-10-20'), published('2026-10-21')];
  assert.deepEqual(getScheduleDecision({ now, settings: value, issues }), { date: '2026-10-22', action: 'prepare', scheduledAt: '2026-10-22T07:00:00.000Z' });
  issues.push(prepared('2026-10-22')); // Manual generation already filled this date.
  assert.equal(canCreateIssue({ date: '2026-10-22', now, publication: value.publication, issues }), false);
  assert.equal(getScheduleDecision({ now, settings: value, issues }).action, 'publish');
  const meta = { issueStates: { '2026-10-22': { status: 'published' } } };
  assert.equal(getScheduleDecision({ now, settings: value, issues, meta }).action, 'none');
  value.publication.time = '06:00';
  assert.equal(getScheduleDecision({ now, settings: value, issues, meta }).action, 'none');
});

test('a persisted timezone-change guard prevents a new daily slot for manual and scheduled generation', () => {
  const before = settings('07:00', 'America/Los_Angeles');
  const after = settings('07:00', 'Asia/Tokyo');
  const now = '2026-10-21T01:00:00Z';
  const issues = [published('2026-10-20')];
  const guard = createScheduleGuard({ now, previousPublication: before.publication, publication: after.publication, issues });
  const meta = { schedule: { changeGuard: guard } };
  assert.equal(guard.until, '2026-10-21T15:00:00.000Z');
  assert.equal(canCreateIssue({ date: '2026-10-21', now, publication: after.publication, issues, meta }), false);
  assert.equal(getScheduleDecision({ now, settings: after, issues, meta }).action, 'none');
  // Writing the guard before the new settings also closes the crash-between-writes path.
  assert.equal(canCreateIssue({ date: '2026-10-21', now, publication: before.publication, issues, meta }), false);
  const toggled = createScheduleGuard({ now, previousPublication: after.publication, publication: before.publication, issues, meta });
  assert.ok(toggled.blockedDates.includes('2026-10-21'));
  assert.equal(canCreateIssue({ date: '2026-10-22', now: '2026-10-21T15:00:00Z', publication: after.publication, issues, meta }), true);
  assert.equal(getScheduleDecision({ now, settings: after, issues: [...issues, prepared('2026-10-21')], meta }).action, 'publish');
});
