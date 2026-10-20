import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveAutoPrint, reservePrint, markPrintSubmitted, markPrintUncertain, recoverPrintJobs, recordPreflightFailure, canAutoPrint } from '../src/core/print-ledger.mjs';

const options = {
  id: 'print-1', issueId: '2026-10-20', deviceName: 'User-selected printer',
  paperSize: 'A4', duplex: 'simplex', now: '2026-10-20T07:00:00Z',
};

test('reservation precedes OS submission and suppresses concurrent/repeated automatic attempts', () => {
  const original = [];
  const first = reserveAutoPrint(original, options);
  assert.deepEqual(original, []);
  assert.equal(first.shouldSubmit, true);
  assert.equal(first.job.status, 'submitting');
  assert.equal(first.job.copies, 1);
  assert.equal(first.job.deviceName, options.deviceName);
  const duplicate = reserveAutoPrint(first.jobs, { ...options, id: 'print-2' });
  assert.equal(duplicate.shouldSubmit, false);
  assert.equal(duplicate.jobs.length, 1);
  const submitted = markPrintSubmitted(first.jobs, first.job.id, options.now);
  assert.equal(submitted[0].status, 'submitted');
  assert.equal(first.jobs[0].status, 'submitting');
  assert.equal(canAutoPrint(submitted, options.issueId), false);
  assert.equal(reserveAutoPrint(submitted, { ...options, id: 'print-3' }).shouldSubmit, false);
});

test('restart and post-OS errors remain uncertain and never enter an automatic retry', () => {
  const first = reserveAutoPrint([], options);
  const restarted = recoverPrintJobs(first.jobs, '2026-10-20T07:02:00Z');
  assert.equal(restarted[0].status, 'uncertain');
  assert.equal(reserveAutoPrint(restarted, { ...options, id: 'retry' }).shouldSubmit, false);
  const uncertain = markPrintUncertain(first.jobs, 'print-1', 'No confirmation from the printer queue.', '2026-10-20T07:01:00Z');
  assert.equal(uncertain[0].status, 'uncertain');
  assert.equal(canAutoPrint(uncertain, options.issueId), false);
  // An eventual confirmation can identify that same submitted job; it creates no new attempt.
  assert.equal(markPrintSubmitted(uncertain, 'print-1', '2026-10-20T07:03:00Z')[0].status, 'submitted');
});

test('an explicit manual submission suppresses later automatic printing, while manual repeats need separate confirmation', () => {
  const manual = reservePrint([], { ...options, automatic: false });
  assert.equal(reserveAutoPrint(manual.jobs, { ...options, id: 'automatic' }).shouldSubmit, false);
  assert.equal(reservePrint(manual.jobs, { ...options, id: 'confirmed-manual-repeat', automatic: false }).shouldSubmit, true);
});

test('missing-printer preflight records send nothing and never select a fallback printer', () => {
  assert.throws(() => reserveAutoPrint([], { ...options, deviceName: '' }));
  assert.throws(() => reserveAutoPrint([], { ...options, issueId: 'sample' }));
  const failed = recordPreflightFailure([], { ...options, automatic: true, deviceName: '', error: 'No printer is selected.' });
  assert.equal(failed[0].status, 'preflight_failed');
  assert.equal(failed[0].deviceName, '');
  const repeated = recordPreflightFailure(failed, { ...options, id: 'next-check', automatic: true, deviceName: '', error: 'No printer is selected.' });
  assert.equal(repeated.length, 1);
  assert.equal(canAutoPrint(repeated, options.issueId), true);
  assert.equal(reserveAutoPrint(repeated, { ...options, id: 'fixed-selection' }).job.deviceName, options.deviceName);
});
