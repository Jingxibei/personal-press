# Desktop implementation contract (v0.1)

This document coordinates the first real, local-first desktop release. Electron main owns disk, credentials, network, PDF generation and printer access. The renderer has no Node access and uses the narrow `window.press` bridge below. No remote service is enabled by default. Paid services and mobile applications remain explicitly marked as planned.

## Module boundaries

- Local data and scheduling: `src/core/settings.mjs`, `src/core/store.mjs`, `src/core/schedule.mjs`, `src/core/print-ledger.mjs`, and their tests.
- Content: `src/core/providers.mjs`, `src/core/feeds.mjs`, `src/core/generator.mjs`, `src/core/entertainment.mjs`, and their tests.
- Reader: all files under `src/renderer/`, plus `src/shared/newspaper.mjs` (pure HTML/CSS renderer used both for reading and printing), `src/shared/sample.mjs`, `src/shared/domains.mjs`.
- Desktop integration: Electron main/preload, package/build files, PDF/EPUB export and publication.

Use native ESM `.mjs` for shared/core code and Node `node:test` for meaningful tests. Electron main and preload are `.cjs`, with main dynamically importing the core modules. Renderer code is local ESM, without a UI framework. Runtime dependencies are pinned in package.json and the lockfile. Never embed real credentials, private schedules or private sources in the repository.

## Settings

```js
{
  version: 1,
  uiLanguage: 'zh-CN', // zh-CN | en | ja
  publication: { title: 'The Personal Press', time: '07:00', timeZone: 'Asia/Shanghai', enabled: false },
  profile: { tracks: [], lenses: [], custom: '', depth: 3 },
  sources: [], // {id, label, url, enabled, freshnessHours:48}; user-supplied public HTTPS RSS/Atom
  model: { provider: 'openai', model: '', baseUrl: '', maxArticles: 6, review: true },
  reading: { languageA: 'en', languageB: 'zh-CN', ratio: 70, fontSize: 17, palette: 'ink', layout: 'newspaper' },
  print: { enabled: false, deviceName: '', paperSize: 'A4', duplex: 'simplex', maxPages: 12, includeLeisure: true },
  entertainment: { enabled: true, sudoku: true, crossword: true, riddle: true, joke: true },
  calendar: { events: [] } // {id,date:'YYYY-MM-DD',time:'HH:mm',title}; never sent to a model
}
```

Four palettes: ink (#FFFFFF/#111111/#454545/#595959), warm (#F6F1E5/#25221E/#514A40/#766B59), aged (#EDE1C8/#2C261D/#4F4536/#796A52), gray (#F0F0ED/#20201E/#50504B/#74746E). Paper text must be isolated from the surrounding UI theme. Print mode ALWAYS uses white paper + dark ink, with no decorative background fill. A4, Letter and A3; duplex is simplex | longEdge | shortEdge. One automatic copy per issue.

## Issue data (immutable content after generation)

```js
{
 id:'YYYY-MM-DD', date:'YYYY-MM-DD', title:'The Personal Press',
 createdAt:'ISO', cutoffAt:'ISO', timeZone:'Asia/Shanghai',
 languageA:'en', languageB:'zh-CN', ratio:70,
 status:'prepared', // stored metadata may transition to published
 sample:false,
 articles:[{
  id:'a1', section:'research',
  titleA:'...', titleB:'...', summaryA:'...', summaryB:'...',
  bodyA:['paragraph'], bodyB:['paragraph'],
  implicationsA:'', implicationsB:'', uncertaintiesA:'', uncertaintiesB:'',
  sourceIds:['s1'], review:{status:'checked',notes:[]}
 }],
 sources:[{id:'s1',title:'...',url:'https://...',publisher:'...',publishedAt:'ISO',retrievedAt:'ISO',excerpt:'...'}],
 review:{status:'checked',notes:[],model:'...'},
 entertainment:{}, calendar:[], model:{provider:'...',name:'...'}
}
```

Model output is untrusted plain text; validate schema, sizes and referenced source IDs. Do not render model HTML. Never claim LLM review is verified truth. Sources and content have explicit dates; do not pass off feed summaries as full article access. Empty or failed retrieval must not fabricate a newspaper. Demo is original clearly labelled sample content and never consumes an official daily issue.

## Renderer bridge

All methods return promises and throw a safe human-readable error; no raw paths, tokens or arbitrary IPC channels exposed.

- `getState()` -> `{settings, issues, credentialStatus, storage, runtime}`. Issue index entries: `{id,date,title,status,createdAt,articleCount,printStatus}`. `credentialStatus` = provider boolean map; `storage` = `{path,credentialProtection}`; `runtime` = `{version,platform,activeJob,nextDelivery,lastError}`.
- `saveSettings(settings)` -> normalized settings. API keys are excluded.
- `saveCredential({provider,key})` -> `{stored:boolean,persistent:boolean}`. Empty key deletes a credential; caller clears the input.
- `listModels({provider,baseUrl})` -> `[{id,name}]`.
- `generateToday()` -> issue. Real generation consumes/reuses today's one official issue.
- `getIssue(id)` -> issue.
- `getSample()` -> labelled offline sample issue; no quota or network.
- `exportIssue({id,format:'pdf'|'epub'|'html',paperSize})` -> `{canceled:boolean,path?:string}`. ID `'sample'` is supported.
- `listPrinters()` -> `[{name,displayName,isDefault,status}]`.
- `testPrint({deviceName,paperSize,duplex})` -> `{submitted:true}`. Only called by an explicit user click.
- `printIssue({id})` -> `{submitted:true}`; shows native confirmation/settings. Scheduled printing has a separate internal path.
- `getPrintJobs()` -> array of records with `{id,issueId,status,deviceName,createdAt,error?}`.
- `openSource(url)` -> opens verified HTTPS link in the system browser, on user click.
- `onStateChanged(callback)` -> unsubscribe function, callback receives no secrets.

## Core module contracts

`settings.mjs`: export `defaultSettings(timeZone?)`, `normalizeSettings(input)` (reject unsafe/invalid input, preserve bounded values).

`store.mjs`: export `createStore(directory)` async, returning `{getSettings(),saveSettings(settings),listIssues(),getIssue(id),saveIssue(issue),publishIssue(id),getMeta(),saveMeta(meta),updateMeta(updater)}`. Methods may be async. `saveIssue` MUST be first-write-wins for one issue date and refuse overwrite with different content. Atomic file writes, path validation, directory permissions; a single Electron instance is the publishing executor. Separate published/prepared state from immutable issue content. `meta` stores schedule and print-job state and no credentials. Use `updateMeta` for serialized read-modify-write changes.

`schedule.mjs`: export `localDay(now,timeZone)`, `resolveLocalTime(day,time,timeZone)` returning Date (first repeated instant; first valid instant after a DST gap), `nextDelivery(now,publication)`, `getScheduleDecision({now,settings,issues,meta})` -> `{date,action:'prepare'|'publish'|'none',scheduledAt?}`. Begin preparing at most 20 minutes early, including shortly-after-midnight delivery. Never catch up old dates. A changed time or timezone cannot create a second already-issued civil day. Main serializes generation/settings and persists `createScheduleGuard({now,previousPublication,publication,issues,meta})` before saving changed settings. Both manual and scheduled generation use `canCreateIssue({date,now,publication,issues,meta})` after first reusing an existing date.

`print-ledger.mjs`: export pure helpers for at-most-one automatic submission per issue, including persisted `submitting` before OS call; submitted/uncertain jobs must never auto retry. Missing/offline printer is a preflight failure; no silent fallback to system default. A successful OS callback means submitted, not physical completion.

`providers.mjs`: export `listModels({provider,apiKey,baseUrl,signal})`, `complete({provider,model,apiKey,baseUrl,system,prompt,signal})` -> string. Only official HTTPS provider endpoints; optional local model endpoint restricted to loopback. No browser-login scraping or reuse of consumer subscription cookies.

`feeds.mjs`: export `collectSources(sources,{now,maxItems,signal,seenUrls})` -> `{items,errors}`. Item shape is Issue.sources above. Safe public HTTPS fetching with redirect validation, private-IP protection, timeouts, payload caps and no credential forwards. RSS/Atom parser; titles/dates/summary and canonical source URLs. No full-page/paywall bypass.

`generator.mjs`: export `generateIssue({date,settings,apiKey,signal,seenUrls,onProgress})` -> issue. Retrieval then source-grounded generation then mandatory review/check of citations, explicit uncertainty; optional second model review controlled by settings.model.review. Calendar attached locally afterward. Keep user private calendar out of all prompts. Provider/model are user-selected IDs, no hardcoded 'latest strongest' claims.

`entertainment.mjs`: export `makeEntertainment(date,languages)` -> deterministic, validated Sudoku and original/localized small diversions; expose solution separately. No copied commercial cartoons or crossword content.

`newspaper.mjs`: export `renderNewspaper(issue,reading,{print=false,includeLeisure=true,paperSize='A4'}={})` -> complete self-contained HTML document. No JS is needed for print; a readable inline newspaper and focused article-reading mode in app. Escape all article/source strings. Rendering new layout/font/palette never calls a model. Keep ratio approximate, label full/summary content honestly, and do not invent omitted-language text. Printer output uses legible type, page breaks and no clipped content. Export `paperStyles` or equivalent if useful.

## Public scope and release

Initial release: desktop local management, real BYOK generation for four providers, embedded reader/history, source citations and review, bilingual styles, four palettes, local schedule while app/computer runs, PDF/EPUB/HTML export, printer discovery/test/manual and scheduled submission. Source extraction is RSS/Atom summary-first; professional research quality depends on supplied sources and clearly bounded evidence.

Roadmap: paid cross-industry discovery, paid hosted service, mobile native apps, vendor-specific automatic e-reader delivery, cloud sync and licensed entertainment. Publish only project source, original sample content and build documentation; keep runtime user data outside version control.
