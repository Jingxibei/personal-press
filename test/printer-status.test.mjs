import test from 'node:test';
import assert from 'node:assert/strict';
import { printerBlockReason } from '../src/core/printer-status.mjs';

test('Windows activity, warm-up, power-save and low toner are not offline flags', () => {
  const nonblocking = [0, 0x100, 0x200, 0x400, 0x2000, 0x4000, 0x8000, 0x10000, 0x20000, 0x800000, 0x1000000];
  for (const status of nonblocking) assert.equal(printerBlockReason({ platform: 'win32', status }), null, `status ${status}`);
  assert.equal(printerBlockReason({ platform: 'win32', status: nonblocking.reduce((a, b) => a | b, 0) }), null);
});

test('Windows blocking bits are recognized even when combined with printing or unknown bits', () => {
  assert.match(printerBlockReason({ platform: 'win32', status: 0x80 | 0x400 }), /offline/);
  assert.match(printerBlockReason({ platform: 'win32', status: 0x82000000 }), /offline/);
  for (const [status, expected] of [[1, /paused/], [8, /jam/], [16, /out of paper/], [0x100000, /intervention/], [2, /error/], [4, /removed/]]) {
    assert.match(printerBlockReason({ platform: 'win32', status }), expected);
  }
});

test('CUPS idle and processing are normal enums, while stopped blocks on Linux and macOS', () => {
  for (const platform of ['linux', 'darwin']) {
    for (const state of [3, 4]) {
      assert.equal(printerBlockReason({ platform, status: state }), null);
      assert.equal(printerBlockReason({ platform, options: { 'printer-state': String(state) } }), null);
    }
    assert.match(printerBlockReason({ platform, status: 5 }), /stopped/);
    assert.match(printerBlockReason({ platform, options: { 'printer-state': '5' } }), /stopped/);
    assert.equal(printerBlockReason({ platform, status: 0x80 }), null);
  }
  assert.match(printerBlockReason({ platform: 'win32', status: 3 }), /paused/);
  assert.equal(printerBlockReason({ platform: 'linux', status: 5, options: { 'printer-state': '3' } }), null);
});

test('a queue rejecting jobs blocks independently of idle or processing state', () => {
  for (const accepting of [false, 'false', ' FALSE ']) {
    assert.match(printerBlockReason({ platform: 'linux', options: { 'printer-state': '3', 'printer-is-accepting-jobs': accepting } }), /not accepting/);
  }
  assert.equal(printerBlockReason({ platform: 'linux', options: { 'printer-state': '4', 'printer-is-accepting-jobs': 'true' } }), null);
});

test('CUPS offline-report explicitly means disconnected despite its report suffix', () => {
  assert.match(printerBlockReason({ platform: 'darwin', options: { 'printer-state': '3', 'printer-state-reasons': 'none,offline-report,com.vendor.snmp.failed' } }), /offline/);
  assert.match(printerBlockReason({ platform: 'linux', options: { 'printer-state-reasons': 'offline' } }), /offline/);
});

test('IPP warnings and reports do not falsely block a usable tray or output device', () => {
  const reasons = 'none,toner-low-warning,media-empty-warning,media-low-report,stopped-partly-warning,connecting-to-device,com.vendor.snmp.failed';
  for (const state of ['3', '4', undefined]) {
    assert.equal(printerBlockReason({ platform: 'linux', options: { 'printer-state': state, 'printer-state-reasons': reasons } }), null);
  }
  assert.equal(printerBlockReason({ platform: 'linux', options: { 'printer-state': '4', 'printer-state-reasons': 'media-empty' } }), null);
});

test('IPP explicit errors, stopped unsuffixed reasons and whole-queue failures block', () => {
  assert.match(printerBlockReason({ options: { 'printer-state-reasons': 'media-jam-error' } }), /jam/);
  assert.match(printerBlockReason({ options: { 'printer-state': '5', 'printer-state-reasons': 'media-empty' } }), /paper supply/);
  for (const [reason, expected] of [['paused', /paused/], ['shutdown', /shut down/], ['spool-area-full', /queue is full/]]) {
    assert.match(printerBlockReason({ options: { 'printer-state-reasons': reason } }), expected);
  }
  const unknownError = printerBlockReason({ options: { 'printer-state-reasons': 'com.vendor.secret-diagnostic-error' } });
  assert.match(unknownError, /error/);
  assert.doesNotMatch(unknownError, /vendor|secret/);
});

test('absent, unknown and malformed state is not asserted to mean offline', () => {
  for (const input of [undefined, null, {}, { platform: 'win32', options: {} }, { platform: 'unknown', status: 5 }]) {
    assert.equal(printerBlockReason(input), null);
  }
  for (const status of [-1, NaN, Infinity, 0.5, 0x1_0000_0000, '128', 'offline']) {
    assert.equal(printerBlockReason({ platform: 'win32', status }), null);
  }
  for (const state of ['', false, '5bad', 'offline', {}, [], 128]) {
    assert.equal(printerBlockReason({ platform: 'linux', options: { 'printer-state': state } }), null);
  }
  assert.equal(printerBlockReason({ options: { 'printer-state-reasons': '<script>offline-error</script>' } }), null);
  assert.equal(printerBlockReason({ options: Object.create({ 'printer-state': '5' }) }), null);
});
