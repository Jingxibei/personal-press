import { assertIssueDate } from './settings.mjs';

const BLOCKING = new Set(['submitting', 'submitted', 'uncertain']);
const STATUSES = new Set([...BLOCKING, 'preflight_failed']);

function text(value, label, max = 256, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError(`Print ledger: invalid ${label}.`);
  return value;
}

function instant(now) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Print ledger: a valid timestamp is required.');
  return date.toISOString();
}

function checkJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.some(job => !job || typeof job !== 'object' || !STATUSES.has(job.status) || typeof job.id !== 'string' || typeof job.issueId !== 'string')) throw new TypeError('Print ledger: invalid job history.');
  return jobs;
}

function request(options, { preflight = false } = {}) {
  if (!options || typeof options !== 'object') throw new TypeError('Print ledger: a job request is required.');
  const { id, issueId, now, automatic = false, paperSize = 'A4', duplex = 'simplex' } = options;
  text(id, 'job ID', 128);
  if (!/^[A-Za-z0-9_-]+$/u.test(id)) throw new TypeError('Print ledger: invalid job ID.');
  if (automatic || !['sample', 'test'].includes(issueId)) assertIssueDate(issueId);
  if (typeof automatic !== 'boolean') throw new TypeError('Print ledger: automatic must be a boolean.');
  if (!['A4', 'A3', 'Letter'].includes(paperSize) || !['simplex', 'longEdge', 'shortEdge'].includes(duplex)) throw new TypeError('Print ledger: invalid paper or duplex setting.');
  const createdAt = instant(now);
  return {
    id, issueId, automatic,
    deviceName: text(options.deviceName, 'printer device name', 256, preflight),
    paperSize, duplex, copies: 1, createdAt, updatedAt: createdAt,
  };
}

/** Reserve only after printer/page-count preflight. Persist jobs BEFORE calling the OS. */
export function reservePrint(jobs, options) {
  checkJobs(jobs);
  const value = request(options);
  const sameId = jobs.find(job => job.id === value.id);
  if (sameId) {
    if (sameId.issueId !== value.issueId) throw new Error('Print ledger: job ID already exists.');
    return { jobs: [...jobs], job: { ...sameId }, shouldSubmit: false };
  }
  if (value.automatic) {
    // A manual submission also suppresses later automatic submission of this issue.
    const existing = jobs.find(job => job.issueId === value.issueId && BLOCKING.has(job.status));
    if (existing) return { jobs: [...jobs], job: { ...existing }, shouldSubmit: false };
  }
  const job = { ...value, status: 'submitting' };
  return { jobs: [...jobs, job], job: { ...job }, shouldSubmit: true };
}

export function reserveAutoPrint(jobs, options) {
  return reservePrint(jobs, { ...options, automatic: true });
}

function change(jobs, id, transform) {
  checkJobs(jobs);
  let found = false;
  const next = jobs.map(job => {
    if (job.id !== id) return job;
    found = true;
    return transform(job);
  });
  if (!found) throw new Error('Print ledger: job not found.');
  return next;
}

/** A successful OS callback means queue submission, never physical completion. */
export function markPrintSubmitted(jobs, id, now) {
  const updatedAt = instant(now);
  return change(jobs, id, job => {
    if (job.status === 'submitted') return job;
    if (!['submitting', 'uncertain'].includes(job.status)) throw new Error('Print ledger: this job was not submitted to the OS.');
    const { error: _error, ...rest } = job;
    return { ...rest, status: 'submitted', updatedAt };
  });
}

/** Any failure after entering the OS boundary is uncertain and must not auto retry. */
export function markPrintUncertain(jobs, id, error, now) {
  const updatedAt = instant(now);
  const message = text(error, 'error description', 600);
  return change(jobs, id, job => {
    if (job.status === 'submitted') return job;
    if (!['submitting', 'uncertain'].includes(job.status)) throw new Error('Print ledger: this job did not enter the OS boundary.');
    return { ...job, status: 'uncertain', error: message, updatedAt };
  });
}

/** Call once at startup and persist before considering any automatic printing. */
export function recoverPrintJobs(jobs, now) {
  checkJobs(jobs);
  const updatedAt = instant(now);
  return jobs.map(job => job.status === 'submitting' ? {
    ...job, status: 'uncertain', updatedAt,
    error: 'The application stopped before printer submission was confirmed. Check the printer before printing again.',
  } : job);
}

/** A preflight failure sends nothing. The same repeated failure creates no extra record. */
export function recordPreflightFailure(jobs, options) {
  checkJobs(jobs);
  const value = request(options, { preflight: true });
  const error = text(options.error, 'error description', 600);
  const duplicate = jobs.find(job => job.issueId === value.issueId && job.deviceName === value.deviceName && job.status === 'preflight_failed' && job.error === error && job.automatic === value.automatic);
  if (duplicate) return [...jobs];
  if (jobs.some(job => job.id === value.id)) throw new Error('Print ledger: job ID already exists.');
  return [...jobs, { ...value, status: 'preflight_failed', error }];
}

export function canAutoPrint(jobs, issueId) {
  checkJobs(jobs);
  assertIssueDate(issueId);
  return !jobs.some(job => job.issueId === issueId && BLOCKING.has(job.status));
}
