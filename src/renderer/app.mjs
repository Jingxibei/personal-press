import { renderNewspaper, escapeHTML as e } from '../shared/newspaper.mjs';
import { domains, lenses, depths, localLabel, describeTrack } from '../shared/domains.mjs';
import { languages, translate } from './i18n.mjs';
import { createPreviewBridge } from './preview-bridge.mjs';

const bridge = window.press || createPreviewBridge();
const preview = Boolean(bridge.isPreview);
const root = document.querySelector('#app');
const copy = value => JSON.parse(JSON.stringify(value));
const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
let state, draft, currentIssue, view='today', dirty=false, busy=false, expanded=false, message='', messageError=false;
let modelList=[], printers=[], jobs=null, saveQueue=Promise.resolve(), quickSaves=0;
let trackDraft={domain:'',branch:'',topics:[],custom:''}, sourceDraft={label:'',url:'',freshnessHours:48}, eventDraft={date:'',time:'',title:''};
let openSections=new Set(['profile']);
const T = key => translate(key,state?.settings?.uiLanguage || 'zh-CN');
const local = map => localLabel(map,state?.settings?.uiLanguage || 'zh-CN');
const option = (value,label,current) => `<option value="${e(value)}"${value===current?' selected':''}>${e(label)}</option>`;
const languageOptions = value => Object.entries(languages).map(([key,name])=>option(key,name,value)).join('');
const disabledRemote = () => preview||busy?' disabled':'';
const checked = value => value?' checked':'';
const getPath = (object,path) => path.split('.').reduce((value,key)=>value?.[key],object);
const setPath = (object,path,value) => {const parts=path.split('.');const last=parts.pop();let target=object;for(const part of parts)target=target[part];target[last]=value;};

function todayDate() {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:state.settings.publication.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${map.year}-${map.month}-${map.day}`;
}
function displayDate(value,withTime=false) {
  if(!value)return '';
  try {const isDay=/^\d{4}-\d{2}-\d{2}$/.test(value);return new Intl.DateTimeFormat(state.settings.uiLanguage,{year:'numeric',month:'short',day:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{}),timeZone:isDay?'UTC':state.settings.publication.timeZone}).format(new Date(isDay?`${value}T12:00:00Z`:value));}
  catch{return String(value).slice(0,100);}
}
function tell(text,error=false) {message=text;messageError=error;const box=document.querySelector('#status');if(box){box.textContent=text;box.className=`status${text?' visible':''}${error?' error':''}`;box.setAttribute('role',error?'alert':'status');}}
function renderRuntime() {
  const notice=document.querySelector('#runtime-notice');if(!notice)return;
  const known={'Preparing the daily edition':'preparing','Reading your public RSS/Atom sources and checking dates and links.':'retrieving','Preparing a bilingual draft grounded only in the retrieved source excerpts.':'generating','Checking article structure, dates, citations, evidence quotes and duplicates.':'checking','Running the optional model consistency review; this is not independent fact verification.':'reviewing','The issue is prepared with dated sources and explicit evidence limits.':'ready'};
  const job=state.runtime?.activeJob,error=state.runtime?.lastError;
  notice.hidden=!job&&!error;
  notice.innerHTML=`${job?`<p>${e(known[job]?T(known[job]):String(job).slice(0,1500))}</p>`:''}${error?`<p class="danger">${T('error')} · ${e(String(error).slice(0,1500))}</p>`:''}`;
}
function markDirty() {dirty=true;const label=document.querySelector('#save-state');if(label)label.textContent=T('unsaved');}
function refreshDisabled() {document.querySelectorAll('[data-remote]').forEach(el=>{el.disabled=preview||busy;});}
async function action(fn) {
  if(busy)return;
  busy=true;refreshDisabled();tell(T('working'));
  try {await fn();}
  catch(error){tell(`${T('error')} · ${String(error?.message || error).slice(0,1500)}`,true);}
  finally{busy=false;refreshDisabled();}
}
async function fetchState({replaceDraft=false}={}) {
  const next=await bridge.getState();
  if(quickSaves)next.settings=state.settings;
  state=next;
  if(replaceDraft||!draft||!dirty)draft=copy(state.settings);
  return next;
}
function quickSetting(path,value) {
  setPath(state.settings,path,value);setPath(draft,path,value);
  const snapshot=copy(state.settings);quickSaves++;
  saveQueue=saveQueue.catch(()=>{}).then(()=>bridge.saveSettings(snapshot)).catch(error=>tell(`${T('error')} · ${error.message}`,true)).finally(()=>{quickSaves--;});
  return saveQueue;
}
function field(label,control,full=false) {return `<label class="field${full?' full':''}"><span>${T(label)}</span>${control}</label>`;}
function input(path,type='text',extra='') {return `<input data-path="${path}" type="${type}" value="${e(getPath(draft,path)??'')}" ${extra}>`;}
function select(path,values) {return `<select data-path="${path}">${values.map(([value,label])=>option(value,label,getPath(draft,path))).join('')}</select>`;}
function check(path,label,extra='') {return `<label class="checkbox"><input type="checkbox" data-path="${path}"${checked(getPath(draft,path))} ${extra}><span>${T(label)}</span></label>`;}
function section(key,heading,body) {return `<details class="settings-section" data-section="${key}"${openSections.has(key)?' open':''}><summary>${T(heading)}</summary><div class="section-body">${body}</div></details>`;}

function renderApp() {
  document.documentElement.lang=state.settings.uiLanguage;
  document.body.classList.toggle('reader-expanded',expanded && view==='today');
  root.innerHTML=`<div class="shell"><header class="app-header"><div class="identity"><span class="seal" aria-hidden="true">PP</span><div><div class="brand">The Personal Press</div><div class="tagline">${T('tagline')}</div></div></div><label class="language-control"><span>${T('interface')}</span><select id="ui-language" aria-label="${T('interface')}">${languageOptions(state.settings.uiLanguage)}</select></label></header><nav class="app-nav" aria-label="The Personal Press">${['today','history','settings'].map(key=>`<button data-view="${key}"${view===key?' aria-current="page"':''}>${T(key)}</button>`).join('')}</nav>${preview?`<aside class="preview-banner">${T('preview')}</aside>`:''}<div id="status" class="status${message?' visible':''}${messageError?' error':''}" role="${messageError?'alert':'status'}" aria-live="polite">${e(message)}</div><main id="main"></main><footer class="runtime-info">${T('runtime')} · ${e(state.runtime?.version||'')} · ${e(state.runtime?.platform||'')}${state.runtime?.nextDelivery?` · ${T('nextDelivery')} ${e(displayDate(state.runtime.nextDelivery,true))}`:''}</footer></div>`;
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;expanded=false;message='';renderApp();window.scrollTo(0,0);}));
  document.querySelector('#ui-language').addEventListener('change',event=>{quickSetting('uiLanguage',event.target.value);renderApp();});
  const runtimeNotice=document.createElement('aside');runtimeNotice.id='runtime-notice';runtimeNotice.className='runtime-notice';runtimeNotice.setAttribute('aria-live','polite');document.querySelector('#main').before(runtimeNotice);renderRuntime();
  if(view==='today')renderToday();else if(view==='history')renderHistory();else renderSettings();
}

function renderToday() {
  const main=document.querySelector('#main'), reading=state.settings.reading, issue=currentIssue;
  const meta=issue?.sample?T('sample'):`${T('issue')} ${issue?.id||''}`;
  main.innerHTML=`<section class="page-heading"><div><p class="eyebrow">THE DAILY READING ROOM</p><h1>${T('readHeading')}</h1><p class="muted">${T('readIntro')}</p></div><div class="actions"><button id="generate" class="primary" data-remote${disabledRemote()}>${T('generate')}</button><button id="load-sample">${T('loadSample')}</button></div></section><div class="edition-bar"><div class="edition-meta"><span class="badge${issue?.sample?' sample':''}">${e(meta)}</span><span>${e(displayDate(issue?.date))}</span><span>${issue?.articles?.length||0} ${T('articles')}</span></div><div class="actions"><select id="export-format" aria-label="${T('export')}">${['pdf','epub','html'].map(format=>option(format,format.toUpperCase(),'pdf')).join('')}</select><button id="export-issue" data-remote${disabledRemote()}>${T('export')}</button><button id="print-issue" data-remote${disabledRemote()}>${T('print')}</button></div></div><div class="reader-controls"><label class="control"><span>${T('paper')}</span><select id="reader-palette">${['ink','warm','aged','gray'].map(value=>option(value,T(value),reading.palette)).join('')}</select></label><label class="control range"><span class="range-label">${T('fontSize')}<output id="font-value">${reading.fontSize}px</output></span><input id="reader-font" type="range" min="12" max="28" step="1" value="${reading.fontSize}"></label><label class="control range"><span class="range-label">${e(languages[issue?.languageA]||languages[reading.languageA])}<output id="ratio-value">${reading.ratio}% / ${100-reading.ratio}%</output></span><input id="reader-ratio" type="range" min="0" max="100" step="5" value="${reading.ratio}" aria-label="${T('ratio')}"></label><label class="control"><span>${T('layout')}</span><select id="reader-layout">${['newspaper','focus'].map(value=>option(value,T(value),reading.layout)).join('')}</select></label><span class="grow"></span><button id="expand-reader" class="small">${T(expanded?'collapse':'expand')}</button></div><p class="reader-notice">${issue?.sample?`${T('sampleNote')} `:''}${T('reflowNote')}</p><div class="paper-frame-wrap"><iframe id="paper-frame" class="paper-frame" title="${e(issue?.title||'The Personal Press')}" sandbox="allow-same-origin"></iframe></div>`;
  document.querySelector('#generate').addEventListener('click',()=>action(async()=>{
    if(dirty)throw new Error(T('draftWarning'));
    await saveQueue;
    const s=state.settings;
    if(!s.sources.some(source=>source.enabled)||!s.model.model.trim()||(s.model.provider!=='local'&&!state.credentialStatus?.[s.model.provider]))throw new Error(T('needConfig'));
    currentIssue=await bridge.generateToday();await fetchState();tell('');renderApp();
  }));
  document.querySelector('#load-sample').addEventListener('click',()=>action(async()=>{await saveQueue;currentIssue=await bridge.getSample();tell('');renderApp();}));
  document.querySelector('#export-issue').addEventListener('click',()=>action(async()=>{await saveQueue;const result=await bridge.exportIssue({id:issue.id,format:document.querySelector('#export-format').value,paperSize:state.settings.print.paperSize});tell(T(result.canceled?'canceled':'exported'));}));
  document.querySelector('#print-issue').addEventListener('click',()=>action(async()=>{await saveQueue;const result=await bridge.printIssue({id:issue.id});tell(T(result?.submitted?'submitted':'canceled'));}));
  document.querySelector('#expand-reader').addEventListener('click',()=>{expanded=!expanded;document.body.classList.toggle('reader-expanded',expanded);document.querySelector('#expand-reader').textContent=T(expanded?'collapse':'expand');resizePaper();});
  for(const [element,path] of [['reader-palette','palette'],['reader-layout','layout'],['reader-font','fontSize'],['reader-ratio','ratio']]) {
    const control=document.getElementById(element);
    const update=()=>{const value=control.type==='range'?Number(control.value):control.value;state.settings.reading[path]=value;draft.reading[path]=value;if(path==='fontSize')document.querySelector('#font-value').textContent=`${value}px`;if(path==='ratio')document.querySelector('#ratio-value').textContent=`${value}% / ${100-value}%`;renderPaper();};
    control.addEventListener('input',update);
    control.addEventListener('change',()=>{update();quickSetting(`reading.${path}`,state.settings.reading[path]);});
  }
  renderPaper();
}

function resizePaper() {
  const frame=document.querySelector('#paper-frame');if(!frame?.contentDocument?.body)return;
  const paper=frame.contentDocument.querySelector('.newspaper');
  frame.style.height=`${Math.ceil(Math.max(paper?.getBoundingClientRect().height||frame.contentDocument.body.scrollHeight,700))+2}px`;
}
function renderPaper() {
  const frame=document.querySelector('#paper-frame');if(!frame||!currentIssue)return;
  let html=renderNewspaper(currentIssue,state.settings.reading);
  const fontURL=new URL('../assets/fonts/fonts.css',import.meta.url).href;
  html=html.replace('</head>',`<link rel="stylesheet" href="${e(fontURL)}"></head>`);
  frame.onload=()=>{
    const doc=frame.contentDocument;if(!doc)return;
    doc.addEventListener('click',event=>{const link=event.target.closest?.('a[data-source-url]');if(!link)return;event.preventDefault();action(async()=>{await bridge.openSource(link.dataset.sourceUrl);tell('');});});
    doc.querySelectorAll('details').forEach(details=>details.addEventListener('toggle',resizePaper));
    resizePaper();doc.fonts?.ready.then(resizePaper);
  };
  frame.srcdoc=html;
}

function renderHistory() {
  const issues=[...(state.issues||[])].sort((a,b)=>b.date.localeCompare(a.date));
  document.querySelector('#main').innerHTML=`<section class="page-heading"><div><p class="eyebrow">THE ARCHIVE</p><h1>${T('history')}</h1><p class="muted">${T('archiveIntro')}</p></div></section>${issues.length?`<div class="archive-grid">${issues.map(issue=>`<article class="archive-card"><span class="eyebrow">${e(displayDate(issue.date))}</span><h2>${e(issue.title)}</h2><p>${T('issue')} ${e(issue.id)} · ${Number(issue.articleCount)||0} ${T('articles')}</p><div><span class="badge">${e(T(issue.status==='published'?'published':'prepared'))}</span></div><div class="actions"><button data-open-issue="${e(issue.id)}">${T('open')}</button></div></article>`).join('')}</div>`:`<div class="empty-state">${T('noHistory')}</div>`}`;
  document.querySelectorAll('[data-open-issue]').forEach(button=>button.addEventListener('click',()=>action(async()=>{currentIssue=await bridge.getIssue(button.dataset.openIssue);view='today';tell('');renderApp();window.scrollTo(0,0);})));
}

function profileHTML() {
  const selectedDomain=domains.find(domain=>domain.id===trackDraft.domain), selectedBranch=selectedDomain?.branches.find(branch=>branch.id===trackDraft.branch);
  return `<p class="hint">${T('profileHint')}</p><div class="track-list">${draft.profile.tracks.length?draft.profile.tracks.map((track,index)=>`<article class="track"><div class="track-head"><p>${e(describeTrack(track,state.settings.uiLanguage))}</p>${index===0?`<span class="badge">${T('primary')}</span>`:''}</div><div class="track-actions"><select data-track-depth="${e(track.id)}" aria-label="${T('depth')}">${option('',T('followDefault'),track.depth===null?'':String(track.depth))}${depths.map(depth=>option(String(depth.value),`${depth.value} · ${local(depth.label)}`,String(track.depth))).join('')}</select>${index?`<button type="button" class="small" data-primary-track="${e(track.id)}">${T('makePrimary')}</button>`:''}<button type="button" class="small subtle" data-remove-track="${e(track.id)}">${T('remove')}</button></div></article>`).join(''):`<p class="hint">${T('noTracks')}</p>`}</div><div class="fields">${field('domain',`<select id="track-domain">${option('',T('chooseDomain'),trackDraft.domain)}${domains.map(domain=>option(domain.id,local(domain.label),trackDraft.domain)).join('')}</select>`,true)}${selectedDomain?field('branch',`<select id="track-branch">${option('',T('wholeDomain'),trackDraft.branch)}${selectedDomain.branches.map(branch=>option(branch.id,local(branch.label),trackDraft.branch)).join('')}</select>`,true):''}</div>${selectedBranch?`<div class="field"><span>${T('topics')}</span></div><div class="chips">${selectedBranch.topics.map(topic=>`<label class="chip"><input type="checkbox" data-topic="${e(topic.value)}"${checked(trackDraft.topics.includes(topic.value))}>${e(local(topic.label))}</label>`).join('')}</div>`:''}<label class="field"><span>${T('customTrack')}</span><textarea id="track-custom" maxlength="2000" placeholder="${e(T('customPlaceholder'))}">${e(trackDraft.custom)}</textarea></label><div class="actions" style="margin-top:10px"><button id="add-track" type="button">${T('addTrack')}</button></div><h3 class="inline-heading">${T('lenses')}</h3><div class="chips">${lenses.map(lens=>`<label class="chip"><input type="checkbox" data-lens="${lens.id}"${checked(draft.profile.lenses.includes(lens.id))}>${e(local(lens.label))}</label>`).join('')}</div><div class="fields">${field('depth',`<select data-path="profile.depth" data-number>${depths.map(depth=>option(String(depth.value),`${depth.value} · ${local(depth.label)}`,String(draft.profile.depth))).join('')}</select>`,true)}</div><p class="hint">${T('depthNote')}</p><label class="field" style="margin-top:15px"><span>${T('generalCustom')}</span><textarea data-path="profile.custom" maxlength="4000">${e(draft.profile.custom)}</textarea></label>`;
}

function sourceModelHTML() {
  const provider=draft.model.provider, localModel=provider==='local', credential=state.credentialStatus?.[provider];
  return `<p class="hint">${T('rssHint')}</p>${draft.sources.length?draft.sources.map(source=>`<div class="source-row"><input type="checkbox" data-source-enabled="${e(source.id)}" aria-label="${T('enabled')} ${e(source.label||source.url)}"${checked(source.enabled)}><div class="source-detail"><strong>${e(source.label||source.url)}</strong><small>${e(source.url)} · ${source.freshnessHours||48}h</small></div><button type="button" class="small subtle" data-remove-source="${e(source.id)}">${T('remove')}</button></div>`).join(''):`<p class="hint">${T('emptySources')}</p>`}<div class="fields">${field('sourceLabel',`<input id="source-label" maxlength="200" value="${e(sourceDraft.label)}">`)}${field('freshness',`<input id="source-freshness" type="number" min="1" max="168" value="${sourceDraft.freshnessHours}">`)}${field('sourceURL',`<input id="source-url" type="url" maxlength="2048" placeholder="https://…" value="${e(sourceDraft.url)}">`,true)}</div><button id="add-source" type="button">${T('addSource')}</button><h3 class="inline-heading">${T('provider')}</h3><div class="fields">${field('provider',select('model.provider',[['openai','OpenAI · GPT'],['gemini','Google · Gemini'],['grok','xAI · Grok'],['deepseek','DeepSeek'],['local',T('localModel')]]),true)}${localModel?field('baseURL',input('model.baseUrl','url','placeholder="http://127.0.0.1:11434/v1" maxlength="2048"'),true):''}${field('modelID',`<input data-path="model.model" list="model-options" value="${e(draft.model.model)}" maxlength="160" autocomplete="off"><datalist id="model-options">${modelList.map(model=>`<option value="${e(model.id)}">${e(model.name||model.id)}</option>`).join('')}</datalist>`,true)}</div><p class="hint">${T(localModel?'localHint':'modelHint')}</p><div class="actions" style="margin-top:10px"><button id="refresh-models" type="button" data-remote${disabledRemote()}>${T('refreshModels')}</button></div>${!localModel?`<div class="fields"><label class="field full"><span>${T('apiKey')} <span class="credential-state">· ${T(credential?'keyStored':'keyMissing')}</span></span><input id="api-key" type="password" autocomplete="off" spellcheck="false" maxlength="4096"${preview?' disabled':''}></label></div><div class="actions"><button id="save-key" type="button" data-remote${disabledRemote()}>${T('saveKey')}</button><button id="delete-key" type="button" class="subtle" data-remote${disabledRemote()}>${T('deleteKey')}</button></div><p class="hint">${T('keyHint')}</p>`:''}<div class="fields">${field('maxArticles',input('model.maxArticles','number','min="1" max="12"'))}</div>${check('model.review','review')}<p class="hint">${T('reviewHint')}</p>`;
}

function publicationHTML() {
  const zones=[...new Set([draft.publication.timeZone,'Asia/Shanghai','Asia/Tokyo','America/Toronto','America/Vancouver','America/New_York','America/Los_Angeles','Europe/London','Europe/Berlin','UTC'])];
  return `<div class="fields">${field('title',input('publication.title','text','maxlength="120" required'),true)}${field('deliveryTime',input('publication.time','time','required'))}${field('timeZone',select('publication.timeZone',zones.map(zone=>[zone,zone])))}</div>${check('publication.enabled','schedule')}<p class="hint">${T('scheduleHint')}</p><p class="hint">${T('timeChange')}</p><p class="hint">${T('oneIssue')}</p><div class="fields">${field('languageA',`<select data-path="reading.languageA">${languageOptions(draft.reading.languageA)}</select>`)}${field('languageB',`<select data-path="reading.languageB">${languageOptions(draft.reading.languageB)}</select>`)}${field('ratio',`<input data-path="reading.ratio" type="number" min="0" max="100" value="${draft.reading.ratio}">`)}${field('fontSize',input('reading.fontSize','number','min="12" max="28"'))}${field('paper',select('reading.palette',['ink','warm','aged','gray'].map(key=>[key,T(key)])))}${field('layout',select('reading.layout',['newspaper','focus'].map(key=>[key,T(key)])))}</div><p class="hint">${T('languageHint')}</p><h3 class="inline-heading">${T('entertainment')}</h3>${check('entertainment.enabled','enabled')}<div class="chips">${['sudoku','crossword','riddle','joke'].map(key=>`<label class="chip"><input type="checkbox" data-path="entertainment.${key}"${checked(draft.entertainment[key])}>${T(key)}</label>`).join('')}</div>`;
}
function calendarHTML() {
  return `<p class="hint">${T('calendarHint')}</p>${draft.calendar.events.length?[...draft.calendar.events].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(event=>`<div class="event-row"><div class="event-detail"><strong>${e(event.title)}</strong><small>${e(event.date)} ${e(event.time)}</small></div><button type="button" class="small subtle" data-remove-event="${e(event.id)}">${T('remove')}</button></div>`).join(''):`<p class="hint">${T('noEvents')}</p>`}<div class="fields">${field('date',`<input id="event-date" type="date" value="${e(eventDraft.date||todayDate())}">`)}${field('time',`<input id="event-time" type="time" value="${e(eventDraft.time)}">`)}${field('eventTitle',`<input id="event-title" maxlength="250" value="${e(eventDraft.title)}">`,true)}</div><button id="add-event" type="button">${T('addEvent')}</button>`;
}
function printingHTML() {
  const options=printers.map(printer=>[printer.name,printer.displayName||printer.name]);
  if(draft.print.deviceName&&!options.some(([name])=>name===draft.print.deviceName))options.unshift([draft.print.deviceName,draft.print.deviceName]);
  return `<p class="hint">${T('printHint')}</p><div class="fields">${field('printer',select('print.deviceName',[['',T('choosePrinter')],...options]),true)}</div><button type="button" id="refresh-printers" data-remote${disabledRemote()}>${T('refreshPrinters')}</button><div class="fields">${field('paperSize',select('print.paperSize',['A4','Letter','A3'].map(value=>[value,value])))}${field('duplex',select('print.duplex',['simplex','longEdge','shortEdge'].map(value=>[value,T(value)])))}${field('maxPages',input('print.maxPages','number','min="1" max="12"'))}</div>${check('print.includeLeisure','includeLeisure')}${check('print.enabled','autoPrint')}<div class="actions"><button type="button" id="test-print" data-remote${disabledRemote()}>${T('testPrint')}</button><button type="button" id="print-jobs" class="subtle" data-remote${disabledRemote()}>${T('printJobs')}</button></div>${jobs?`<div class="job-list">${jobs.length?jobs.map(job=>`<div>${e(job.issueId||'test')} · ${e(job.deviceName||'')} · ${e(job.status)}<br>${e(displayDate(job.createdAt,true))}${job.error?` · ${e(job.error)}`:''}</div>`).join(''):`<p class="hint">${T('noPrintJobs')}</p>`}</div>`:''}`;
}

function renderSettings() {
  document.querySelector('#main').innerHTML=`<section class="page-heading"><div><p class="eyebrow">YOUR EDITORIAL DESK</p><h1>${T('settings')}</h1><p class="muted">${T('settingsIntro')}</p></div></section><div class="settings-layout"><form id="settings-form" class="settings-form">${section('profile','profile',profileHTML())}${section('sources','sourceModel',sourceModelHTML())}${section('publication','editionSettings',publicationHTML())}${section('calendar','calendar',calendarHTML())}${section('printing','printing',printingHTML())}<div class="save-bar"><span id="save-state">${T(dirty?'unsaved':'settings')}</span><button type="submit" class="primary" id="save-settings">${T('save')}</button></div></form><aside class="settings-sidebar"><section class="side-note"><h3>${T('privacy')}</h3><p>${T('privacyText')}</p></section><section class="side-note"><span class="badge">${T('planned')}</span><p>${T('plannedText')}</p></section></aside></div>`;
  bindSettings();
}

function bindSettings() {
  document.querySelectorAll('[data-section]').forEach(details=>details.addEventListener('toggle',()=>{if(details.open)openSections.add(details.dataset.section);else openSections.delete(details.dataset.section);}));
  document.querySelectorAll('[data-path]').forEach(control=>{
    const update=()=>{const path=control.dataset.path;const value=control.type==='checkbox'?control.checked:control.type==='number'||control.hasAttribute('data-number')?Number(control.value):control.value;setPath(draft,path,value);markDirty();};
    control.addEventListener('input',update);
    control.addEventListener('change',()=>{
      update();
      if(control.dataset.path==='model.provider'){draft.model.model='';draft.model.baseUrl='';modelList=[];renderSettings();}
      if(['reading.languageA','reading.languageB'].includes(control.dataset.path)&&draft.reading.languageA===draft.reading.languageB){const other=control.dataset.path==='reading.languageA'?'languageB':'languageA';draft.reading[other]=Object.keys(languages).find(language=>language!==control.value);renderSettings();}
    });
  });
  document.querySelector('#track-domain').addEventListener('change',event=>{trackDraft.domain=event.target.value;trackDraft.branch='';trackDraft.topics=[];renderSettings();});
  document.querySelector('#track-branch')?.addEventListener('change',event=>{trackDraft.branch=event.target.value;trackDraft.topics=[];renderSettings();});
  document.querySelector('#track-custom').addEventListener('input',event=>{trackDraft.custom=event.target.value;});
  document.querySelectorAll('[data-topic]').forEach(control=>control.addEventListener('change',()=>{trackDraft.topics=control.checked?[...new Set([...trackDraft.topics,control.dataset.topic])]:trackDraft.topics.filter(topic=>topic!==control.dataset.topic);}));
  document.querySelector('#add-track').addEventListener('click',()=>{
    if(!trackDraft.domain&&!trackDraft.custom.trim()){tell(T('emptyTrack'),true);return;}
    if(draft.profile.tracks.length>=24){tell(T('trackLimit'),true);return;}
    draft.profile.tracks.push({id:id('track'),...copy(trackDraft),domain:trackDraft.domain||'custom',depth:null});trackDraft={domain:'',branch:'',topics:[],custom:''};markDirty();tell('');renderSettings();
  });
  document.querySelectorAll('[data-remove-track]').forEach(button=>button.addEventListener('click',()=>{draft.profile.tracks=draft.profile.tracks.filter(track=>track.id!==button.dataset.removeTrack);markDirty();renderSettings();}));
  document.querySelectorAll('[data-primary-track]').forEach(button=>button.addEventListener('click',()=>{const index=draft.profile.tracks.findIndex(track=>track.id===button.dataset.primaryTrack);if(index>0)draft.profile.tracks.unshift(draft.profile.tracks.splice(index,1)[0]);markDirty();renderSettings();}));
  document.querySelectorAll('[data-track-depth]').forEach(control=>control.addEventListener('change',()=>{draft.profile.tracks.find(track=>track.id===control.dataset.trackDepth).depth=control.value?Number(control.value):null;markDirty();}));
  document.querySelectorAll('[data-lens]').forEach(control=>control.addEventListener('change',()=>{draft.profile.lenses=control.checked?[...new Set([...draft.profile.lenses,control.dataset.lens])]:draft.profile.lenses.filter(lens=>lens!==control.dataset.lens);markDirty();}));
  for(const [element,key] of [['source-label','label'],['source-url','url'],['source-freshness','freshnessHours']])document.getElementById(element).addEventListener('input',event=>{sourceDraft[key]=key==='freshnessHours'?Number(event.target.value):event.target.value;});
  document.querySelector('#add-source').addEventListener('click',()=>{
    try {const url=new URL(sourceDraft.url.trim());if(url.protocol!=='https:'||url.username||url.password||url.hash||!url.hostname.includes('.'))throw new Error();if(!Number.isInteger(sourceDraft.freshnessHours)||sourceDraft.freshnessHours<1||sourceDraft.freshnessHours>168)throw new Error();if(draft.sources.length>=50)throw new Error();draft.sources.push({id:id('source'),label:sourceDraft.label.trim(),url:url.href,enabled:true,freshnessHours:sourceDraft.freshnessHours});sourceDraft={label:'',url:'',freshnessHours:48};markDirty();tell('');renderSettings();}
    catch{tell(T('invalidSource'),true);}
  });
  document.querySelectorAll('[data-remove-source]').forEach(button=>button.addEventListener('click',()=>{draft.sources=draft.sources.filter(source=>source.id!==button.dataset.removeSource);markDirty();renderSettings();}));
  document.querySelectorAll('[data-source-enabled]').forEach(control=>control.addEventListener('change',()=>{draft.sources.find(source=>source.id===control.dataset.sourceEnabled).enabled=control.checked;markDirty();}));
  document.querySelector('#refresh-models').addEventListener('click',()=>action(async()=>{if(draft.model.provider!=='local'&&!state.credentialStatus?.[draft.model.provider])throw new Error(T('keyMissing'));modelList=await bridge.listModels({provider:draft.model.provider,baseUrl:draft.model.baseUrl});tell(T(modelList.length?'modelsLoaded':'noModels'));renderSettings();}));
  document.querySelector('#save-key')?.addEventListener('click',()=>action(async()=>{const input=document.querySelector('#api-key'),key=input.value.trim();input.value='';if(!key)throw new Error(T('emptyKey'));const result=await bridge.saveCredential({provider:draft.model.provider,key});await fetchState();tell(T(result.persistent?'keySaved':'keySession'));renderSettings();}));
  document.querySelector('#delete-key')?.addEventListener('click',()=>action(async()=>{document.querySelector('#api-key').value='';await bridge.saveCredential({provider:draft.model.provider,key:''});await fetchState();tell(T('keyDeleted'));renderSettings();}));
  for(const [element,key] of [['event-date','date'],['event-time','time'],['event-title','title']])document.getElementById(element).addEventListener('input',event=>{eventDraft[key]=event.target.value;});
  document.querySelector('#add-event').addEventListener('click',()=>{const date=document.querySelector('#event-date').value;if(!date||!eventDraft.title.trim()){tell(T('invalidEvent'),true);return;}draft.calendar.events.push({id:id('event'),date,time:eventDraft.time,title:eventDraft.title.trim()});eventDraft={date:'',time:'',title:''};markDirty();tell('');renderSettings();});
  document.querySelectorAll('[data-remove-event]').forEach(button=>button.addEventListener('click',()=>{draft.calendar.events=draft.calendar.events.filter(event=>event.id!==button.dataset.removeEvent);markDirty();renderSettings();}));
  document.querySelector('#refresh-printers').addEventListener('click',()=>action(async()=>{printers=await bridge.listPrinters();tell(printers.length?'':T('noPrinters'));renderSettings();}));
  document.querySelector('#test-print').addEventListener('click',()=>action(async()=>{if(!draft.print.deviceName)throw new Error(T('printerRequired'));const result=await bridge.testPrint({deviceName:draft.print.deviceName,paperSize:draft.print.paperSize,duplex:draft.print.duplex});tell(T(result?.submitted?'submitted':'canceled'));}));
  document.querySelector('#print-jobs').addEventListener('click',()=>action(async()=>{jobs=await bridge.getPrintJobs();tell('');renderSettings();}));
  document.querySelector('#settings-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    if(!event.target.reportValidity())return;
    if(draft.print.enabled&&!draft.print.deviceName)throw new Error(T('printerRequired'));
    if(draft.publication.enabled&&(!draft.sources.some(source=>source.enabled)||!draft.model.model.trim()||(draft.model.provider!=='local'&&!state.credentialStatus?.[draft.model.provider])))throw new Error(T('needConfig'));
    await saveQueue;
    const normalized=await bridge.saveSettings(copy(draft));state.settings=normalized;draft=copy(normalized);dirty=false;tell(T('saved'));renderApp();
  });});
}

window.addEventListener('resize',resizePaper);
try {
  await fetchState({replaceDraft:true});
  const today=state.issues?.find(issue=>issue.date===todayDate()&&issue.status==='published');
  currentIssue=today?await bridge.getIssue(today.id):await bridge.getSample();
  renderApp();
  bridge.onStateChanged(async()=>{try{await fetchState();renderRuntime();if(view==='history')renderHistory();const today=state.issues?.find(issue=>issue.date===todayDate()&&issue.status==='published');if(!busy&&view==='today'&&currentIssue?.sample&&today){currentIssue=await bridge.getIssue(today.id);renderToday();}const footer=document.querySelector('.runtime-info');if(footer)footer.textContent=`${T('runtime')} · ${state.runtime?.version||''} · ${state.runtime?.platform||''}${state.runtime?.nextDelivery?` · ${T('nextDelivery')} ${displayDate(state.runtime.nextDelivery,true)}`:''}`;}catch(error){tell(`${T('error')} · ${error.message}`,true);}});
} catch(error) {root.innerHTML=`<div class="shell"><h1>The Personal Press</h1><p role="alert">${e(String(error?.message||error))}</p></div>`;}
