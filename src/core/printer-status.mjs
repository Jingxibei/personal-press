/*
 * Preflight uses only state exposed by the OS/driver; it does not probe a device.
 * Electron 36 removed PrinterInfo.status (and isDefault), so current versions
 * may expose no usable availability state, especially on Windows. A null result
 * means no recognized blocking signal, NOT that the printer is online or that
 * a submitted job will physically finish.
 *
 * Platform definitions:
 * https://www.electronjs.org/docs/latest/breaking-changes#removed-isdefault-and-status-properties-on-printerinfo
 * https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-rprn/1625e9d9-29e4-48f4-b83d-3bd0fdaea787
 * https://www.rfc-editor.org/rfc/rfc8011.html#section-5.4.11
 * https://www.rfc-editor.org/rfc/rfc8011.html#section-5.4.12
 * https://www.rfc-editor.org/rfc/rfc8011.html#section-5.4.23
 */

const OFFLINE = 'The printer driver reports that the printer is offline or disconnected.';
const PAUSED = 'The printer driver reports that the printer is paused.';
const STOPPED = 'The printer driver reports that the printer is stopped and needs attention.';
const DRIVER_ERROR = 'The printer driver reports an error that prevents printing.';

// PRINTER_INFO_2.Status is a DWORD bitmask, not a WMI printer-status enum.
// Busy, printing, processing, waiting, warm-up, power-save, low toner and an
// unknown server status alone are not evidence that new jobs must be blocked.
const WINDOWS_BLOCKS = [
  [0x00000080 | 0x02000000, OFFLINE],
  [0x00000004, 'The printer is being removed and cannot accept new jobs.'],
  [0x00000001, PAUSED],
  [0x00000008, 'The printer driver reports a paper jam.'],
  [0x00000010, 'The printer driver reports that the printer is out of paper.'],
  [0x00000020, 'The printer driver reports that manual paper feeding is required.'],
  [0x00000040, 'The printer driver reports a paper problem.'],
  [0x00000800, 'The printer driver reports that the output tray is full.'],
  [0x00001000, 'The printer driver reports that the printer is unavailable for printing.'],
  [0x00040000, 'The printer driver reports that the printer is out of toner.'],
  [0x00080000, 'The printer driver reports that it cannot print the current page.'],
  [0x00100000, 'The printer driver reports that user intervention is required.'],
  [0x00200000, 'The printer driver reports that the printer is out of memory.'],
  [0x00400000, 'The printer driver reports that a printer door is open.'],
  [0x00000002, DRIVER_ERROR],
];

const IPP_REASONS = new Map([
  ['paused', PAUSED],
  ['shutdown', 'The printer driver reports that the printer has been shut down.'],
  ['spool-area-full', 'The printer queue is full and cannot accept another job.'],
  ['media-jam', 'The printer driver reports a paper jam.'],
  ['media-empty', 'The printer driver reports a paper supply error.'],
  ['media-needed', 'The printer driver reports that paper must be supplied.'],
  ['toner-empty', 'The printer driver reports that the printer is out of toner.'],
  ['marker-supply-empty', 'The printer driver reports an empty ink, toner or ribbon supply.'],
  ['door-open', 'The printer driver reports that a printer door is open.'],
  ['cover-open', 'The printer driver reports that a printer cover is open.'],
  ['interlock-open', 'The printer driver reports that a safety interlock is open.'],
  ['output-area-full', 'The printer driver reports that the output area is full.'],
  ['timed-out', 'The printer driver reports that the printer did not respond.'],
]);

function stateValue(value) {
  if (typeof value === 'string' && /^[345]$/.test(value.trim())) return Number(value.trim());
  return value === 3 || value === 4 || value === 5 ? value : null;
}

/**
 * Return a fixed human-readable reason to stop before submitting a job, or null.
 * Pass the complete native PrinterInfo, with platform: process.platform.
 * Unknown/missing driver data cannot establish physical printer availability.
 * @param {{platform?:string,status?:number,options?:Record<string,unknown>}} input
 * @returns {string|null}
 */
export function printerBlockReason(input = {}) {
  const { platform, status, options } = input && typeof input === 'object' ? input : {};
  const option = (key) => options && typeof options === 'object' && Object.hasOwn(options, key)
    ? options[key] : undefined;
  const accepting = option('printer-is-accepting-jobs');
  if (accepting === false || (typeof accepting === 'string' && accepting.trim().toLowerCase() === 'false')) {
    return 'The printer queue is not accepting new jobs.';
  }

  // CUPS uses an IPP enum: 3 idle, 4 processing, 5 stopped. Never test it as
  // Win32 flags. Prefer the currently exposed option over a legacy status.
  const state = stateValue(option('printer-state'))
    ?? (platform === 'linux' || platform === 'darwin' ? stateValue(status) : null);
  const rawReasons = option('printer-state-reasons');
  const reasons = typeof rawReasons === 'string' && rawReasons.length <= 16_384
    ? rawReasons.toLowerCase().split(/[,\s]+/, 256).filter((value) => /^[a-z][a-z0-9._-]{0,254}$/.test(value))
    : [];

  for (const reason of reasons) {
    const base = reason.replace(/-(?:report|warning|error)$/, '');
    // CUPS explicitly emits offline-report for ENXIO / "not connected" and
    // removes it after successful I/O. This is a documented backend exception
    // to the usual nonblocking -report severity, not a generic suffix rule.
    // https://github.com/OpenPrinting/cups/blob/master/backend/runloop.c
    if (base === 'offline') return OFFLINE;
    // These reasons describe the queue/device as a whole, not a single tray.
    if (base === 'paused' || base === 'shutdown' || base === 'spool-area-full') {
      return IPP_REASONS.get(base);
    }
    // RFC 8011: -warning/-report may describe one of several output devices;
    // in particular media-empty-warning does not mean all trays are empty.
    // An explicit -error is blocking. An unsuffixed reason is an error only
    // when the printer is stopped; otherwise it is a warning.
    if (base !== 'none' && (reason.endsWith('-error') || (state === 5 && reason === base))) {
      return IPP_REASONS.get(base) ?? DRIVER_ERROR;
    }
  }
  if (state === 5) return STOPPED;

  if (platform === 'win32' && Number.isInteger(status) && status >= 0 && status <= 0xffff_ffff) {
    for (const [mask, reason] of WINDOWS_BLOCKS) if ((status & mask) !== 0) return reason;
  }
  return null;
}
