const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell, Menu, Tray, nativeImage, powerMonitor, Notification } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { randomUUID, createHash } = require('node:crypto');

// Chromium has optional background services beyond page requests. This local
// reader does not need component downloads, account sync or network time probes.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-sync');
app.on('session-created', session => {
  // The download base is a local, intentionally empty location. Disabling the
  // checker alone can still initialize a Chromium dictionary download.
  session.setSpellCheckerDictionaryDownloadURL(pathToFileURL(path.join(__dirname, 'assets', 'no-dictionaries') + path.sep).href);
  session.setSpellCheckerEnabled(false);
});

let mainWindow, tray, store, vault, modules, timer, quitting = false;
let activeJob = '', lastError = '', generating = false, ticking = false;
let mutationTail = Promise.resolve();
const smokeArgument = process.argv.find(value => value.startsWith('--smoke-test='));
const smokeDirectory = smokeArgument && !app.isPackaged ? path.resolve(smokeArgument.slice('--smoke-test='.length)) : null;
if (smokeDirectory) app.setPath('userData', path.join(smokeDirectory, 'user-data'));
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

const mutate = operation => {
  const result = mutationTail.then(operation, operation);
  mutationTail = result.catch(() => {});
  return result;
};
const errorText = error => vault ? vault.redact(error?.message || error) : String(error?.message || error).slice(0, 300);
const notify = () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('press:state-changed'); };
const printFingerprint = print => createHash('sha256').update(JSON.stringify({ deviceName: print.deviceName, paperSize: print.paperSize, duplex: print.duplex })).digest('hex');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);

function secureWindow(window, { primary = false } = {}) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  const session = window.webContents.session;
  session.setSpellCheckerEnabled(false);
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  // Network requests are owned by the main-process provider/feed clients only.
  session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
  if (primary) window.webContents.on('render-process-gone', () => { lastError = 'The reader stopped. Reopen the application to continue.'; });
}

async function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); return; }
  mainWindow = new BrowserWindow({
    width: 1220, height: 900, minWidth: 760, minHeight: 600,
    title: 'Personal Press', backgroundColor: '#efeee9', show: false,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false }
  });
  secureWindow(mainWindow, { primary: true });
  mainWindow.on('close', event => {
    if (!quitting && tray) { event.preventDefault(); mainWindow.hide(); }
  });
  await mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  mainWindow.show();
}

async function getState() {
  const settings = await store.getSettings();
  const issues = await store.listIssues();
  const meta = await store.getMeta();
  const next = modules.schedule.nextDelivery(new Date(), settings.publication);
  return {
    settings,
    issues: issues.map(issue => ({ ...issue, printStatus: [...(meta.printJobs || [])].reverse().find(job => job.issueId === issue.id)?.status || '' })),
    credentialStatus: await vault.status(),
    storage: { path: app.getPath('userData'), credentialProtection: vault.persistent ? 'os-keychain' : 'session-only' },
    runtime: { version: app.getVersion(), platform: process.platform, activeJob, nextDelivery: next?.toISOString() || null, lastError }
  };
}

async function sourceHistory() {
  const sources = new Set();
  for (const entry of (await store.listIssues()).slice(0, 90)) {
    const issue = await store.getIssue(entry.id);
    for (const source of issue?.sources || []) if (source.url) sources.add(source.url);
  }
  return [...sources];
}

async function generate(date, { publish = false, automatic = false } = {}) {
  let existing = await store.getIssue(date);
  if (existing) {
    if (publish && existing.status !== 'published') await store.publishIssue(date);
    return store.getIssue(date);
  }
  if (generating) throw new Error('An edition is already being prepared.');
  generating = true;
  activeJob = 'Preparing the daily edition'; lastError = ''; notify();
  try {
    const settings = await store.getSettings();
    const eligible = modules.schedule.canCreateIssue({ date, now: new Date(), publication: settings.publication, issues: await store.listIssues(), meta: await store.getMeta() });
    if (!eligible) throw new Error('The publishing-day change takes effect with the next eligible edition.');
    if (!settings.sources.some(source => source.enabled)) throw new Error('Add and enable at least one RSS or Atom source before generating an edition.');
    if (!settings.model.model) throw new Error('Choose a model in Settings before generating an edition.');
    const apiKey = await vault.get(settings.model.provider);
    if (!apiKey && settings.model.provider !== 'local') throw new Error('Add an API key for the selected model provider.');
    await store.updateMeta(meta => {
      meta.generationAttempts ||= {};
      const previous = meta.generationAttempts[date] || { count: 0 };
      meta.generationAttempts[date] = { count: previous.count + 1, startedAt: new Date().toISOString(), automatic };
      return meta;
    });
    const signal = AbortSignal.timeout(8 * 60 * 1000);
    const issue = await modules.generator.generateIssue({ date, settings, apiKey, signal, seenUrls: await sourceHistory(), onProgress: progress => { activeJob = errorText(progress?.message || progress); notify(); } });
    issue.id = date; issue.date = date; issue.sample = false; issue.status = 'prepared';
    issue.timeZone = settings.publication.timeZone;
    issue.calendar = settings.calendar.events.filter(event => event.date === date).map(event => ({ ...event }));
    await store.saveIssue(issue);
    if (publish) await store.publishIssue(date);
    existing = await store.getIssue(date);
    return existing;
  } catch (error) {
    lastError = errorText(error);
    await store.updateMeta(meta => {
      meta.generationAttempts ||= {};
      const previous = meta.generationAttempts[date] || { count: 0 };
      meta.generationAttempts[date] = { ...previous, failedAt: new Date().toISOString(), error: lastError };
      return meta;
    });
    throw error;
  } finally { generating = false; activeJob = ''; notify(); }
}

async function issueById(id) {
  if (id === 'sample') return modules.sample.getSampleIssue((await store.getSettings()).reading);
  if (typeof id !== 'string') throw new Error('Choose an edition.');
  const issue = await store.getIssue(id);
  if (!issue) throw new Error('The requested edition is not in this local archive.');
  return issue;
}

async function documentWindow(html) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'personal-press-'));
  await fs.chmod(directory, 0o700);
  const file = path.join(directory, 'paper.html');
  const fontUrl = pathToFileURL(path.join(__dirname, 'assets/fonts/fonts.css')).href;
  const additions = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' file:; font-src file: data:; img-src data:; script-src 'none'"><link rel="stylesheet" href="${escapeHtml(fontUrl)}">`;
  html = html.replace(/<head(?:\s[^>]*)?>/i, match => match + additions);
  await fs.writeFile(file, html, { mode: 0o600 });
  const window = new BrowserWindow({ show: false, width: 1100, height: 900, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false, partition: 'personal-press-print' } });
  secureWindow(window);
  const cleanup = async () => { if (!window.isDestroyed()) window.destroy(); await fs.rm(directory, { recursive: true, force: true }); };
  try {
    await window.loadFile(file);
    await Promise.race([window.webContents.executeJavaScript('document.fonts.ready.then(() => true)'), new Promise((_, reject) => setTimeout(() => reject(new Error('Local fonts did not finish loading.')), 15000))]);
    return { window, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

async function renderPdf(issue, settings, { printing = false, paperSize = settings.print.paperSize } = {}) {
  const html = modules.newspaper.renderNewspaper(issue, settings.reading, { print: printing, includeLeisure: settings.print.includeLeisure, paperSize });
  const document = await documentWindow(html);
  try {
    const pdf = await document.window.webContents.printToPDF({ pageSize: paperSize, printBackground: !printing, preferCSSPageSize: true, margins: { top: .4, bottom: .4, left: .4, right: .4 }, generateTaggedPDF: true });
    const { PDFDocument } = await import('pdf-lib');
    const pageCount = (await PDFDocument.load(pdf)).getPageCount();
    return { pdf, pageCount };
  } finally { await document.cleanup(); }
}

async function exportIssue(payload) {
  if (!payload || !['pdf', 'epub', 'html'].includes(payload.format)) throw new Error('Unsupported export format.');
  const issue = await issueById(payload.id), settings = await store.getSettings();
  const paperSize = ['A4', 'Letter', 'A3'].includes(payload.paperSize) ? payload.paperSize : settings.print.paperSize;
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Export newspaper', defaultPath: `personal-press-${issue.id}.${payload.format}`, filters: [{ name: payload.format.toUpperCase(), extensions: [payload.format] }] });
  if (result.canceled || !result.filePath) return { canceled: true };
  let data;
  if (payload.format === 'pdf') data = (await renderPdf(issue, settings, { paperSize })).pdf;
  else if (payload.format === 'epub') data = modules.epub.makeEpub(issue, settings.reading);
  else data = modules.newspaper.renderNewspaper(issue, settings.reading, { paperSize, includeLeisure: settings.print.includeLeisure });
  await fs.writeFile(result.filePath, data, { mode: 0o600 });
  return { canceled: false, path: result.filePath };
}

async function listPrinters() {
  return (await mainWindow.webContents.getPrintersAsync()).map(printer => ({ name: printer.name, displayName: printer.displayName || printer.name, isDefault: printer.isDefault, status: printer.status }));
}

function validatePrintSettings(value) {
  if (!value || typeof value.deviceName !== 'string' || !value.deviceName || value.deviceName.length > 512) throw new Error('Select a printer installed in this operating system.');
  if (!['A4', 'Letter', 'A3'].includes(value.paperSize) || !['simplex', 'longEdge', 'shortEdge'].includes(value.duplex)) throw new Error('Invalid paper or duplex setting.');
}

async function assertPrinter(print) {
  validatePrintSettings(print);
  const installed = await mainWindow.webContents.getPrintersAsync();
  const selected = installed.find(printer => printer.name === print.deviceName);
  if (!selected) throw new Error('The selected printer is not available. No other printer was used.');
  const blocked = modules.printerStatus.printerBlockReason({ platform: process.platform, status: selected.status, options: selected.options });
  if (blocked) throw new Error(blocked);
}

function submit(window, print, { silent }) {
  if (smokeDirectory) throw new Error('Physical printing is disabled in smoke-test mode.');
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('The printer submission result is unknown. Check the system queue before printing again.')); }
    }, 90000);
    try {
      window.webContents.print({ silent, deviceName: print.deviceName, pageSize: print.paperSize, duplexMode: print.duplex, color: false, printBackground: false, copies: 1, collate: true, margins: { marginType: 'default' } }, (success, reason) => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        if (success) resolve({ submitted: true });
        else reject(new Error(reason ? `Printer submission was not confirmed: ${reason}` : 'Printer submission was not confirmed.'));
      });
    } catch (error) { settled = true; clearTimeout(timeout); reject(error); }
  });
}

async function testPrint(print) {
  await assertPrinter(print);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${print.paperSize};margin:18mm}body{background:#fff;color:#111;font:16px 'Noto Serif SC','Noto Serif JP',serif}h1{font:38px 'Libre Caslon Display',serif;border-bottom:3px double;padding-bottom:12px}p{line-height:1.8}.rule{border-bottom:1px solid #111;margin:30px 0}</style></head><body><h1>The Personal Press</h1><h2>Print test · 打印测试 · テスト印刷</h2><p>${escapeHtml(print.deviceName)}</p><p>${escapeHtml(print.paperSize)} · ${escapeHtml(print.duplex)}</p><p>One daily edition. 一天一份日报。毎日一部の新聞。</p><div class="rule"></div><p>Confirm that the text is complete and readable before enabling scheduled printing.<br>请确认文字完整清楚，再开启定时打印。<br>文字が欠けずに読めることを確認してから、定時印刷を有効にしてください。</p></body></html>`;
  const document = await documentWindow(html);
  try {
    const result = await submit(document.window, print, { silent: true });
    await store.updateMeta(meta => { meta.printerTest = { fingerprint: printFingerprint(print), submittedAt: new Date().toISOString() }; return meta; });
    notify(); return result;
  } finally { await document.cleanup(); }
}

async function printIssue(issue, { automatic = false } = {}) {
  const settings = await store.getSettings(), print = settings.print;
  if (automatic && (issue.sample || !print.enabled)) return { submitted: false };
  if (automatic && issue.date !== modules.schedule.localDay(new Date(), settings.publication.timeZone)) return { submitted: false };
  const jobId = randomUUID();
  let document;
  try {
    if (automatic) {
      const meta = await store.getMeta();
      if (meta.printerTest?.fingerprint !== printFingerprint(print)) throw new Error('Submit a test page for these printer settings before enabling automatic printing.');
      if ((meta.printJobs || []).some(job => job.issueId === issue.id && ['submitting', 'submitted', 'uncertain'].includes(job.status))) return { submitted: false };
    }
    await assertPrinter(print);
    const html = modules.newspaper.renderNewspaper(issue, settings.reading, { print: true, includeLeisure: print.includeLeisure, paperSize: print.paperSize });
    document = await documentWindow(html);
    const pdf = await document.window.webContents.printToPDF({ pageSize: print.paperSize, printBackground: false, preferCSSPageSize: true, margins: { top: .4, bottom: .4, left: .4, right: .4 } });
    const { PDFDocument } = await import('pdf-lib');
    const pages = (await PDFDocument.load(pdf)).getPageCount();
    if (automatic && pages > print.maxPages) throw new Error(`This edition has ${pages} pages, above your ${print.maxPages}-page automatic print limit. Adjust the layout or use the explicit manual print dialog.`);
    // Rendering and printer discovery may cross midnight. Recheck the issue day
    // immediately before reserving a job so late work cannot print yesterday.
    if (automatic && issue.date !== modules.schedule.localDay(new Date(), settings.publication.timeZone)) return { submitted: false };
    let reserved;
    await store.updateMeta(meta => {
      const request = { id: jobId, issueId: issue.id, deviceName: print.deviceName, paperSize: print.paperSize, duplex: print.duplex, now: new Date(), automatic };
      reserved = automatic ? modules.printLedger.reserveAutoPrint(meta.printJobs || [], request) : modules.printLedger.reservePrint(meta.printJobs || [], request);
      meta.printJobs = reserved.jobs;
      return meta;
    });
    if (!reserved.shouldSubmit) return { submitted: false };
    try {
      const result = await submit(document.window, print, { silent: automatic });
      await store.updateMeta(meta => { meta.printJobs = modules.printLedger.markPrintSubmitted(meta.printJobs || [], jobId, new Date()); return meta; });
      notify(); return result;
    } catch (error) {
      await store.updateMeta(meta => { meta.printJobs = modules.printLedger.markPrintUncertain(meta.printJobs || [], jobId, errorText(error), new Date()); return meta; });
      throw error;
    }
  } catch (error) {
    lastError = errorText(error);
    await store.updateMeta(meta => {
      if (!(meta.printJobs || []).some(job => job.id === jobId)) meta.printJobs = modules.printLedger.recordPreflightFailure(meta.printJobs || [], { id: jobId, issueId: issue.id, deviceName: print.deviceName, paperSize: print.paperSize, duplex: print.duplex, error: lastError, now: new Date(), automatic });
      if (automatic) meta.printBlocked = { issueId: issue.id, fingerprint: printFingerprint(print), error: lastError };
      return meta;
    });
    notify(); throw error;
  } finally { if (document) await document.cleanup(); }
}

async function saveSettings(input) {
  const previous = await store.getSettings(), next = modules.settings.normalizeSettings(input);
  if (next.print.enabled) {
    if (!next.publication.enabled) throw new Error('Enable the daily schedule before enabling scheduled printing.');
    await assertPrinter(next.print);
    const meta = await store.getMeta();
    if (meta.printerTest?.fingerprint !== printFingerprint(next.print)) throw new Error('Send a test page with the selected printer, paper size and duplex setting before enabling scheduled printing.');
  }
  const issues = await store.listIssues();
  if (modules.schedule.publicationSignature(previous.publication) !== modules.schedule.publicationSignature(next.publication)) {
    const guard = modules.schedule.createScheduleGuard({ now: new Date(), previousPublication: previous.publication, publication: next.publication, issues, meta: await store.getMeta() });
    await store.updateMeta(meta => { meta.schedule ||= {}; meta.schedule.changeGuard = guard; return meta; });
  }
  await store.saveSettings(next);
  // An explicit save may resolve preflight errors (page limit, type size, paper,
  // availability). The durable ledger still forbids duplicate automatic jobs.
  await store.updateMeta(meta => { delete meta.printBlocked; return meta; });
  notify(); return next;
}

async function tick() {
  if (ticking || generating || quitting) return;
  ticking = true;
  try {
    await mutate(async () => {
      const settings = await store.getSettings();
      if (!settings.publication.enabled) return;
      const now = new Date(), issues = await store.listIssues(), meta = await store.getMeta();
      const decision = modules.schedule.getScheduleDecision({ now, settings, issues, meta });
      const attempt = meta.generationAttempts?.[decision.date];
      const backoff = attempt?.failedAt && (attempt.count >= 3 || now.getTime() - new Date(attempt.failedAt).getTime() < 10 * 60 * 1000);
      if (decision.action === 'prepare' && !backoff) await generate(decision.date, { automatic: true });
      if (decision.action === 'publish') {
        await generate(decision.date, { publish: true, automatic: true });
        if (Notification.isSupported() && !smokeDirectory) new Notification({ title: settings.publication.title, body: settings.uiLanguage === 'ja' ? '今日の新聞が届きました。' : settings.uiLanguage === 'en' ? 'Your daily edition is ready.' : '今天的报纸已准备好。' }).show();
      }
      const deliveryNow = new Date();
      const today = modules.schedule.localDay(deliveryNow, settings.publication.timeZone);
      const issue = await store.getIssue(today);
      const updated = await store.getMeta();
      const due = modules.schedule.resolveLocalTime(today, settings.publication.time, settings.publication.timeZone);
      const blocked = updated.printBlocked?.issueId === today && updated.printBlocked?.fingerprint === printFingerprint(settings.print);
      if (settings.print.enabled && issue?.status === 'published' && deliveryNow >= due && !blocked) await printIssue(issue, { automatic: true });
    });
  } catch (error) { lastError = errorText(error); notify(); }
  finally { ticking = false; }
}

function registerIpc() {
  const handlers = {
    getState,
    saveSettings: input => mutate(() => saveSettings(input)),
    saveCredential: payload => mutate(async () => {
      if (!payload || typeof payload.provider !== 'string') throw new Error('Choose a model provider.');
      const result = await vault.save(payload.provider, payload.key); notify(); return result;
    }),
    listModels: async payload => {
      if (!payload || !['openai', 'gemini', 'grok', 'deepseek', 'local'].includes(payload.provider)) throw new Error('Choose a model provider.');
      return modules.providers.listModels({ provider: payload.provider, baseUrl: payload.baseUrl, apiKey: await vault.get(payload.provider), signal: AbortSignal.timeout(30000) });
    },
    generateToday: () => mutate(async () => {
      const settings = await store.getSettings();
      const date = modules.schedule.localDay(new Date(), settings.publication.timeZone);
      return generate(date, { publish: true });
    }),
    getIssue: issueById,
    getSample: async () => modules.sample.getSampleIssue((await store.getSettings()).reading),
    exportIssue: payload => mutate(() => exportIssue(payload)),
    listPrinters,
    testPrint: payload => mutate(() => testPrint(payload)),
    printIssue: payload => mutate(async () => printIssue(await issueById(payload?.id))),
    getPrintJobs: async () => [...((await store.getMeta()).printJobs || [])].reverse(),
    openSource: async value => {
      const resolved = await modules.feeds.resolvePublicUrl(value, { signal: AbortSignal.timeout(7000) });
      await shell.openExternal(resolved.url.href); return { opened: true };
    }
  };
  for (const [name, handler] of Object.entries(handlers)) ipcMain.handle(`press:${name}`, async (event, payload) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Untrusted IPC sender.');
    try { return await handler(payload); }
    catch (error) { throw new Error(errorText(error)); }
  });
}

async function makeTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, 'assets/tray.png'));
  if (image.isEmpty()) return;
  if (process.platform === 'darwin') image.setTemplateImage(true);
  try {
    tray = new Tray(image); tray.setToolTip('Personal Press');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open / 打开 / 開く', click: () => createWindow() },
      { type: 'separator' },
      { label: 'Quit / 退出 / 終了', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', () => createWindow());
  } catch { tray = null; }
}

async function smokeTest() {
  await fs.mkdir(smokeDirectory, { recursive: true });
  await mainWindow.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  const bridge = await mainWindow.webContents.executeJavaScript('window.press.getSample().then(issue => ({hasBridge: true, sample: issue.sample, nodeExposed: typeof window.require !== "undefined"}))');
  const settings = await store.getSettings();
  const languageArgument = process.argv.find(value => value.startsWith('--smoke-language='))?.split('=')[1];
  const paperArgument = process.argv.find(value => value.startsWith('--smoke-paper='))?.split('=')[1];
  if (['zh-CN','en','ja'].includes(languageArgument)) settings.reading = { ...settings.reading, languageA: languageArgument, languageB: languageArgument === 'en' ? 'zh-CN' : 'en' };
  if (['A4','Letter','A3'].includes(paperArgument)) settings.print.paperSize = paperArgument;
  const issue = modules.sample.getSampleIssue(settings.reading);
  const output = await renderPdf(issue, settings, { printing: true });
  await fs.writeFile(path.join(smokeDirectory, 'sample-print.pdf'), output.pdf);
  await fs.writeFile(path.join(smokeDirectory, 'sample.epub'), modules.epub.makeEpub(issue, settings.reading));
  await new Promise(resolve => setTimeout(resolve, 350));
  await fs.writeFile(path.join(smokeDirectory, 'reader.png'), (await mainWindow.webContents.capturePage()).toPNG());
  const result = { ...bridge, version: app.getVersion(), platform: process.platform, paperSize: settings.print.paperSize, languageA: issue.languageA, languageB: issue.languageB, pages: output.pageCount, physicalPrintingDisabled: true, contextIsolation: mainWindow.webContents.getLastWebPreferences().contextIsolation, sandbox: mainWindow.webContents.getLastWebPreferences().sandbox };
  await fs.writeFile(path.join(smokeDirectory, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); quitting = true; app.quit();
}

app.on('second-instance', () => createWindow());
app.on('before-quit', () => { quitting = true; if (timer) clearInterval(timer); });
app.on('window-all-closed', () => { if (!tray) app.quit(); });
app.on('activate', () => createWindow());

if (singleInstance) app.whenReady().then(async () => {
  const [settings, storage, schedule, printLedger, providers, generator, newspaper, sample, epub, credentials, feeds, printerStatus] = await Promise.all([
    import('./core/settings.mjs'), import('./core/store.mjs'), import('./core/schedule.mjs'), import('./core/print-ledger.mjs'), import('./core/providers.mjs'), import('./core/generator.mjs'), import('./shared/newspaper.mjs'), import('./shared/sample.mjs'), import('./core/epub.mjs'), import('./core/vault.mjs'), import('./core/feeds.mjs'), import('./core/printer-status.mjs')
  ]);
  modules = { settings, schedule, printLedger, providers, generator, newspaper, sample, epub, feeds, printerStatus };
  store = await storage.createStore(path.join(app.getPath('userData'), 'archive'));
  vault = new credentials.CredentialVault(path.join(app.getPath('userData'), 'credentials'), safeStorage);
  await store.updateMeta(meta => { meta.printJobs = printLedger.recoverPrintJobs(meta.printJobs || [], new Date()); return meta; });
  registerIpc();
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Personal Press', submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Quit / 退出 / 終了', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } }] }, { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] }]));
  await createWindow();
  if (smokeDirectory && !app.isPackaged) { await smokeTest(); return; }
  await makeTray();
  timer = setInterval(() => tick(), 30000);
  powerMonitor.on('resume', () => tick());
  await tick();
}).catch(error => {
  const message = errorText(error);
  console.error(message);
  if (smokeDirectory) { fs.writeFile(path.join(smokeDirectory, 'error.txt'), message).catch(() => {}); quitting = true; app.exit(1); }
  else { dialog.showErrorBox('Personal Press', message); quitting = true; app.quit(); }
});
