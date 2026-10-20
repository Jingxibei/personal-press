export const palettes = Object.freeze({
  ink: { paper: '#FFFFFF', ink: '#111111', muted: '#454545', rule: '#595959' },
  warm: { paper: '#F6F1E5', ink: '#25221E', muted: '#514A40', rule: '#766B59' },
  aged: { paper: '#EDE1C8', ink: '#2C261D', muted: '#4F4536', rule: '#796A52' },
  gray: { paper: '#F0F0ED', ink: '#20201E', muted: '#50504B', rule: '#74746E' },
});

const labels = {
  'zh-CN': { sample: '离线样报 · 原创示例，不占正式刊期', issue: '期号', daily: '每日最多一期', cutoff: '素材截止', created: '生成时间', main: '正文', summary: '概要', implications: '可能影响', uncertainty: '不确定性与适用条件', sources: '来源与证据', source: '来源', published: '来源日期', retrieved: '获取时间', review: '引用与内容检查', checked: '已完成检查；不代表事实保证', needsReview: '请核对原始来源与检查说明', notes: '检查说明', leisure: '读报之后，留一点闲暇', calendar: '今日行事历', localCalendar: '本地加入，未发送给模型', sudoku: '每日数独', sudokuHelp: '每行、每列、每个 3 × 3 宫格填入不重复的 1–9。', crossword: '文字游戏', across: '横向', down: '纵向', answers: '查看答案', riddle: '每日一谜', joke: '茶余一笑', noArticles: '这份稿件没有可阅读的文章。', undated: '未提供日期', ratio: '目标篇幅', ratioNote: '使用本期已保存的正文与概要重排，不会生成新内容。', noSource: '未关联可用来源', feedNote: '来源材料可能仅为 RSS／Atom 摘要，并不表示已读取原文全文。', sampleSource: '样报为原创示例，未声称报道真实最新新闻。' },
  en: { sample: 'Offline sample · original content; no official daily issue used', issue: 'Issue', daily: 'At most one daily edition', cutoff: 'Source cutoff', created: 'Generated', main: 'Full text', summary: 'Summary', implications: 'Possible implications', uncertainty: 'Uncertainty and conditions', sources: 'Sources and evidence', source: 'Source', published: 'Source date', retrieved: 'Retrieved', review: 'Citation and content checks', checked: 'Checks completed; not a guarantee of factual accuracy', needsReview: 'Check the original sources and review notes', notes: 'Review notes', leisure: 'A little room for thought', calendar: "The day’s diary", localCalendar: 'Added locally; not sent to a model', sudoku: 'Daily Sudoku', sudokuHelp: 'Fill every row, column and 3 × 3 box with the digits 1–9.', crossword: 'Word puzzle', across: 'Across', down: 'Down', answers: 'Show answers', riddle: 'A daily riddle', joke: 'A lighter note', noArticles: 'This issue contains no readable articles.', undated: 'Date not provided', ratio: 'Target language share', ratioNote: 'Reflows the stored text and summaries. No new content is generated.', noSource: 'No available source linked', feedNote: 'Source material may be an RSS or Atom summary; this does not imply full-article access.', sampleSource: 'This original sample does not claim to report current news.' },
  ja: { sample: 'オフライン見本紙 · オリジナル例文。正式な日刊号には数えません', issue: '号数', daily: '正式な日刊紙は一日一号まで', cutoff: '資料の締切', created: '生成日時', main: '本文', summary: '要約', implications: '考えられる影響', uncertainty: '不確実性と適用条件', sources: '出典と根拠', source: '出典', published: '出典の日付', retrieved: '取得日時', review: '引用と内容の点検', checked: '点検済み。事実の正しさを保証するものではありません', needsReview: '原資料と点検メモをご確認ください', notes: '点検メモ', leisure: '読書のあとに、ひと息', calendar: '今日の予定', localCalendar: '端末内で追加。モデルには送信しません', sudoku: '今日の数独', sudokuHelp: '各行・各列・各 3 × 3 の枠に、1〜9 を一つずつ入れます。', crossword: '言葉のパズル', across: '横', down: '縦', answers: '答えを見る', riddle: '今日のなぞなぞ', joke: '小さな笑い', noArticles: 'この号には閲覧できる記事がありません。', undated: '日付の記載なし', ratio: '言語の目安', ratioNote: '保存済みの本文と要約を組み直します。新しい内容は生成しません。', noSource: '利用できる出典の関連付けなし', feedNote: '資料が RSS／Atom の要約だけの場合もあります。原文全文の取得を意味しません。', sampleSource: 'オリジナルの見本紙であり、最新ニュースの報道ではありません。' },
};

const languageNames = { en: 'English', 'zh-CN': '中文', ja: '日本語' };
const normalizeLanguage = (value) => value === 'zh-Hans' ? 'zh-CN' : (labels[value] ? value : 'en');
const text = (value, limit = 50000) => typeof value === 'string' ? value.slice(0, limit) : '';
export const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const e = escapeHTML;
const localized = (value, lang) => typeof value === 'string' ? value : text(value?.[lang] ?? value?.en ?? value?.['zh-CN'] ?? value?.ja);
const paragraphs = (value) => (Array.isArray(value) ? value : []).filter((p) => typeof p === 'string').slice(0, 80).map((p) => `<p>${e(text(p))}</p>`).join('');
const safeURL = (value) => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; } };

function formatDate(value, language, timeZone, withTime = false) {
  if (!value) return labels[language].undated;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (!Number.isFinite(date.getTime())) return labels[language].undated;
  try { return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'UTC' : timeZone }).format(date); }
  catch { return String(value).slice(0, 32); }
}

export function paperStyles({ print = false, paperSize = 'A4', palette = 'ink', fontSize = 17, layout = 'newspaper' } = {}) {
  const colors = print ? palettes.ink : (palettes[palette] || palettes.ink);
  const size = ['A4', 'Letter', 'A3'].includes(paperSize) ? paperSize : 'A4';
  const body = Math.min(28, Math.max(12, Number(fontSize) || 17));
  const printBody = Math.min(21, Math.max(9, body * .75));
  const printColumns = layout === 'focus' ? 1 : size === 'A3' ? 3 : 2;
  return `
    :root { color-scheme: only light; --paper:${colors.paper}; --ink:${colors.ink}; --muted:${colors.muted}; --rule:${colors.rule}; --body:${body}px; }
    * { box-sizing:border-box; }
    html, body { margin:0; padding:0; background:var(--paper); color:var(--ink); }
    body { font-family:Georgia,'Noto Serif SC','Songti SC',serif; font-size:var(--body); line-height:1.68; overflow-wrap:anywhere; }
    .newspaper { max-width:${layout === 'focus' ? '820px' : '1160px'}; margin:auto; padding:28px 32px; background:var(--paper); color:var(--ink); }
    .newspaper :where(h1,h2,h3,h4,p,div,span,b,strong,em,small,blockquote,section,article,header,footer,ol,ul,li,dl,dt,dd,table,thead,tbody,tr,th,td,figcaption,time) { color:inherit; }
    :lang(ja) { font-family:'Noto Serif JP','Yu Mincho',serif; line-break:strict; }
    :lang(zh-CN) { line-break:strict; }
    h1,h2,h3,h4,p { margin-top:0; } p { margin-bottom:.85em; orphans:3; widows:3; }
    h1,h2,h3,h4 { break-after:avoid; font-weight:600; }
    .newspaper a,.newspaper a:visited { color:var(--ink); text-decoration:underline; text-underline-offset:3px; }
    .mastline,.folio,.eyebrow,.meta,.article-label,.source-list,.source-note,.review,.caption,summary { font-family:Arial,'Noto Serif SC','Noto Serif JP',sans-serif; }
    .mastline { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; font-size:11px; letter-spacing:.8px; color:var(--muted); }
    .masthead { font-family:'Libre Caslon Display',Georgia,'Noto Serif SC','Noto Serif JP',serif; font-weight:400; font-size:clamp(36px,6vw,78px); line-height:1.1; text-align:center; margin:12px 0 18px; letter-spacing:-1.7px; }
    .folio { display:flex; justify-content:space-between; flex-wrap:wrap; gap:7px 18px; padding:8px 0; border-top:4px solid var(--ink); border-bottom:1px solid var(--ink); font-size:11px; color:var(--muted); }
    .sample-notice { padding:10px 0; margin:0; font-size:12px; border-bottom:1px solid var(--rule); font-family:Arial,'Noto Serif SC','Noto Serif JP',sans-serif; }
    .edition-note { margin:12px 0 20px; font-size:11px; color:var(--muted); }
    .story { border-bottom:1px solid var(--rule); padding:0 0 22px; margin:0 0 24px; }
    .eyebrow { font-size:11px; letter-spacing:1px; margin:0 0 6px; color:var(--muted); text-transform:uppercase; }
    .story-title { font-size:clamp(27px,3.6vw,43px); line-height:1.25; margin-bottom:12px; text-wrap:balance; }
    .story-title:lang(en) { font-family:'Libre Caslon Display',Georgia,serif; font-weight:400; font-size:clamp(32px,4.5vw,52px); }
    .deck { font-size:1.04em; margin-bottom:15px; }
    .bilingual { display:grid; grid-template-columns:minmax(0,var(--major,7fr)) minmax(0,var(--minor,3fr)); gap:25px; }
    .bilingual.single { display:block; }
    .story-language { min-width:0; }
    .story-language.secondary { border-left:1px solid var(--rule); padding-left:22px; }
    .article-label { font-size:11px; letter-spacing:.7px; color:var(--muted); margin:0 0 9px; break-after:avoid; }
    .secondary h3 { font-size:1.2em; line-height:1.45; margin-bottom:9px; }
    .analysis { font-size:.93em; margin-top:16px; }
    .analysis h4 { font-size:1em; margin-bottom:5px; }
    .citations { font-size:12px; margin:14px 0 0; }
    .review { font-size:11px; color:var(--muted); margin:10px 0 0; line-height:1.7; }
    .review ul { padding-left:18px; margin:4px 0 0; }
    .section-title { font-family:'Libre Caslon Display',Georgia,'Noto Serif SC',serif; font-weight:400; font-size:32px; line-height:1.35; border-bottom:3px double var(--ink); padding-bottom:10px; margin:26px 0 17px; }
    .source-list { font-size:12px; line-height:1.7; padding-left:25px; }
    .source-list li { padding-bottom:10px; margin-bottom:10px; border-bottom:1px solid var(--rule); }
    .source-list p { margin:4px 0 0; } .source-url { word-break:break-word; }
    .source-note { font-size:12px; color:var(--muted); }
    .leisure-grid { display:grid; grid-template-columns:1fr 1fr; gap:25px; }
    .diversion { break-inside:avoid; border-top:1px solid var(--rule); padding-top:12px; margin:0 0 22px; }
    .diversion h3 { font-size:1.3em; margin:0 0 8px; }
    .caption { color:var(--muted); font-size:12px; line-height:1.7; }
    table,tbody,tr,th,td { background:transparent; }
    .sudoku { width:100%; max-width:350px; table-layout:fixed; border-collapse:collapse; border:2px solid var(--ink); font-family:Georgia,serif; font-size:22px; margin:12px 0; }
    .sudoku td { width:11.111%; height:34px; text-align:center; border:1px solid var(--rule); padding:2px; }
    .sudoku td:nth-child(3n) { border-right:2px solid var(--ink); } .sudoku tr:nth-child(3n) td { border-bottom:2px solid var(--ink); }
    .word-grid { border-collapse:collapse; margin:12px 0; font-family:Georgia,serif; font-size:19px; }
    .word-grid td { width:34px; height:34px; position:relative; border:1px solid var(--rule); text-align:center; padding:2px; }
    .word-grid td.block { background:var(--ink); color:var(--paper); } .block-mark { display:none; } .word-grid small { position:absolute; top:0; left:2px; font-size:9px; line-height:1.2; }
    .clues { font-size:13px; } .clues p { margin:3px 0; }
    summary { font-size:12px; text-decoration:underline; text-underline-offset:3px; padding:7px 0; }
    .answers { margin:10px 0; } .answers p { margin:7px 0; }
    .agenda { border-collapse:collapse; width:100%; font-size:.9em; }
    .agenda td { border-bottom:1px solid var(--rule); padding:9px 4px; vertical-align:top; } .agenda td:first-child { width:65px; font-weight:600; white-space:nowrap; }
    .bottomline { border-top:2px solid var(--ink); padding-top:8px; margin-top:22px; font-size:10px; color:var(--muted); font-family:Arial,'Noto Serif SC',sans-serif; }
    ${layout === 'focus' ? '.bilingual{display:block}.story-language.secondary{border-left:0;border-top:1px solid var(--rule);padding:16px 0 0;margin-top:18px}.story-title{font-size:34px}.leisure-grid{grid-template-columns:1fr}' : ''}
    @media(max-width:620px) { .newspaper{padding:18px 16px}.masthead{font-size:37px;letter-spacing:-1px}.bilingual{display:block}.story-language.secondary{border-left:0;border-top:1px solid var(--rule);padding:14px 0 0;margin-top:16px}.leisure-grid{grid-template-columns:1fr}.story-title{font-size:29px}.story-title:lang(en){font-size:38px} }
    @page { size:${size}; margin:13mm; }
    @media print { :root{--paper:#fff;--ink:#111;--muted:#454545;--rule:#595959;--body:${printBody}pt} html,body,.newspaper{background:#fff!important;color:#111!important}.newspaper{max-width:none;padding:0}body{font-size:${printBody}pt;line-height:1.55}.masthead{font-size:37pt}.folio{font-size:8pt}.mastline,.edition-note,.review,.source-note,.caption{font-size:8.5pt}.story-title,.story-title:lang(en){font-size:24pt}.bilingual{display:block;column-count:${printColumns};column-gap:7mm;column-rule:1px solid var(--rule);column-fill:balance}.story-language.secondary{border-left:0;border-top:1px solid var(--rule);padding:10px 0 0;margin-top:12px}.story{break-inside:auto}.story-language{break-inside:auto}.story-title,.eyebrow,.article-label,h3,h4{break-after:avoid}p{orphans:3;widows:3;break-inside:auto}.leisure-grid{display:block;column-count:${layout === 'focus' ? 1 : 2};column-gap:7mm;column-fill:balance}.diversion{display:inline-block;width:100%;break-inside:avoid}.sudoku{max-width:74mm;font-size:12pt}.sudoku td{height:7mm}.word-grid td{width:7mm;height:7mm}.word-grid td.block{background:#fff!important;color:#111!important;border:2px solid #111}.block-mark{display:block;font-size:15pt;line-height:1}.source-list,.clues{font-size:9pt}.answers{display:none}.bottomline{font-size:8pt}a{color:#111!important;text-decoration:none}.source-url{overflow-wrap:anywhere} }
    ${layout === 'newspaper' ? '@media print { body{line-height:1.45}p{margin-bottom:.6em}.story{padding-bottom:15px;margin-bottom:17px}.story-title{margin-bottom:9px}.deck{margin-bottom:10px}.section-title{margin:18px 0 12px;padding-bottom:8px}.diversion{margin-bottom:14px}.caption{line-height:1.5}.bottomline{margin-top:16px} }' : ''}
  `;
}

function sudokuTable(grid) {
  if (!Array.isArray(grid) || grid.length !== 9 || grid.some((row) => !Array.isArray(row) || row.length !== 9)) return '';
  return `<table class="sudoku"><tbody>${grid.map((row) => `<tr>${row.map((value) => `<td>${Number.isInteger(value) && value >= 1 && value <= 9 ? value : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function wordTable(grid, clues) {
  if (!Array.isArray(grid) || !grid.length || grid.length > 15) return '';
  const numbers = new Map();
  for (const clue of [...(clues?.across || []), ...(clues?.down || [])]) {
    if (Number.isInteger(clue.row) && Number.isInteger(clue.col) && Number.isInteger(clue.number)) numbers.set(`${clue.row}:${clue.col}`, clue.number);
  }
  return `<table class="word-grid"><tbody>${grid.map((row, r) => `<tr>${(Array.isArray(row) ? row : []).slice(0, 15).map((value, c) => `<td${value === '#' ? ' class="block"' : ''}>${value !== '#' && numbers.has(`${r}:${c}`) ? `<small>${numbers.get(`${r}:${c}`)}</small>` : ''}${value === '#' ? '<span class="block-mark">×</span>' : e(text(value, 2))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function entertainmentHTML(issue, lang) {
  const L = labels[lang], data = issue.entertainment || {}, sections = [];
  const calendar = (Array.isArray(issue.calendar) ? issue.calendar : []).filter((event) => !event.date || event.date === issue.date).slice(0, 30);
  if (calendar.length) sections.push(`<section class="diversion"><h3>${L.calendar}</h3><p class="caption">${L.localCalendar}</p><table class="agenda"><tbody>${calendar.map((event) => `<tr><td>${e(text(event.time, 5))}</td><td>${e(text(event.title, 300))}</td></tr>`).join('')}</tbody></table></section>`);
  if (data.sudoku && sudokuTable(data.sudoku.grid)) sections.push(`<section class="diversion"><h3>${e(localized(data.sudoku.title, lang) || L.sudoku)}</h3><p class="caption">${L.sudokuHelp}</p>${sudokuTable(data.sudoku.grid)}<details class="answers"><summary>${L.answers}</summary>${sudokuTable(data.sudoku.solution)}</details></section>`);
  if (data.crossword && wordTable(data.crossword.grid, data.crossword.clues)) {
    const game = data.crossword;
    const clues = ['across', 'down'].map((direction) => `<div><strong>${L[direction]}</strong>${(Array.isArray(game.clues?.[direction]) ? game.clues[direction] : []).slice(0, 30).map((clue) => `<p>${e(clue.number)}. ${e(localized(clue.clue, lang))}</p>`).join('')}</div>`).join('');
    sections.push(`<section class="diversion"><h3>${e(localized(game.title, lang) || L.crossword)}</h3>${localized(game.note, lang) ? `<p class="caption">${e(localized(game.note, lang))}</p>` : ''}${wordTable(game.grid, game.clues)}<div class="clues">${clues}</div><details class="answers"><summary>${L.answers}</summary>${wordTable(game.solution, game.clues)}</details></section>`);
  }
  if (localized(data.riddle?.question, lang)) sections.push(`<section class="diversion"><h3>${L.riddle}</h3><p>${e(localized(data.riddle.question, lang))}</p><details class="answers"><summary>${L.answers}</summary><p>${e(localized(data.riddle.answer, lang))}</p></details></section>`);
  if (localized(data.joke?.text, lang)) sections.push(`<section class="diversion"><h3>${L.joke}</h3><p>${e(localized(data.joke.text, lang))}</p></section>`);
  return sections.length ? `<section class="leisure" lang="${lang}"><h2 class="section-title">${L.leisure}</h2>${localized(data.notice, lang) ? `<p class="caption">${e(localized(data.notice, lang))}</p>` : ''}<div class="leisure-grid">${sections.join('')}</div></section>` : '';
}

export function renderNewspaper(issue = {}, reading = {}, { print = false, includeLeisure = true, paperSize = 'A4' } = {}) {
  const langA = normalizeLanguage(issue.languageA), langB = normalizeLanguage(issue.languageB || 'zh-CN');
  const ratio = Math.max(0, Math.min(100, Number.isFinite(Number(reading.ratio)) ? Number(reading.ratio) : Number.isFinite(Number(issue.ratio)) ? Number(issue.ratio) : 70));
  const majorA = ratio >= 50, primaryLang = majorA ? langA : langB, L = labels[primaryLang];
  const title = text(issue.title, 180) || 'The Personal Press';
  const sources = (Array.isArray(issue.sources) ? issue.sources : []).slice(0, 200);
  const sourceNumbers = new Map(sources.map((source, index) => [source.id, index + 1]));
  const articles = (Array.isArray(issue.articles) ? issue.articles : []).slice(0, 30);
  const full = (article, suffix, lang, label, secondary = false) => {
    const body = Array.isArray(article[`body${suffix}`]) ? article[`body${suffix}`] : [];
    return `<section class="story-language${secondary ? ' secondary' : ''}" lang="${lang}"><p class="article-label">${e(languageNames[lang])} · ${body.length ? label : labels[lang].summary}</p>${secondary && text(article[`title${suffix}`]) ? `<h3>${e(text(article[`title${suffix}`]))}</h3>` : ''}${paragraphs(body.length ? body : [text(article[`summary${suffix}`])])}${text(article[`implications${suffix}`]) ? `<div class="analysis"><h4>${labels[lang].implications}</h4><p>${e(text(article[`implications${suffix}`]))}</p></div>` : ''}${text(article[`uncertainties${suffix}`]) ? `<div class="analysis"><h4>${labels[lang].uncertainty}</h4><p>${e(text(article[`uncertainties${suffix}`]))}</p></div>` : ''}</section>`;
  };
  const articlesHTML = articles.map((article, index) => {
    const major = majorA ? 'A' : 'B', minor = majorA ? 'B' : 'A', minorLang = majorA ? langB : langA;
    const majorTitle = text(article[`title${major}`]);
    const secondaryPresent = ratio > 0 && ratio < 100 && langA !== langB && (text(article[`summary${minor}`]) || article[`body${minor}`]?.some?.((p) => text(p)));
    const majorWidth = Math.min(70, Math.max(ratio, 100 - ratio));
    const citationIds = [...new Set(Array.isArray(article.sourceIds) ? article.sourceIds : [])].filter((id) => sourceNumbers.has(id));
    const citations = citationIds.length ? citationIds.map((id) => `<a href="#source-${sourceNumbers.get(id)}">[${sourceNumbers.get(id)}]</a>`).join(' ') : e(issue.sample ? L.sampleSource : L.noSource);
    const notes = (Array.isArray(article.review?.notes) ? article.review.notes : []).filter((note) => typeof note === 'string').slice(0, 12);
    return `<article class="story" id="article-${index + 1}"><p class="eyebrow">${e(text(article.section, 80))}</p><h2 class="story-title" lang="${primaryLang}">${e(majorTitle)}</h2>${text(article[`summary${major}`]) ? `<p class="deck" lang="${primaryLang}">${e(text(article[`summary${major}`]))}</p>` : ''}<div class="bilingual${secondaryPresent ? '' : ' single'}" style="--major:${majorWidth}fr;--minor:${100-majorWidth}fr">${full(article, major, primaryLang, L.main)}${secondaryPresent ? full(article, minor, minorLang, labels[minorLang].main, true) : ''}</div><p class="citations">${L.source} · ${citations}</p>${!issue.sample ? `<div class="review">${L.review} · ${article.review?.status === 'checked' ? L.checked : L.needsReview}${notes.length ? `<ul>${notes.map((note) => `<li>${e(text(note, 3000))}</li>`).join('')}</ul>` : ''}</div>` : ''}</article>`;
  }).join('');
  const issueReviewHTML = !issue.sample && Array.isArray(issue.review?.notes) && issue.review.notes.length ? `<section class="review"><h2 class="section-title">${L.review}</h2><ul>${issue.review.notes.filter(note => typeof note === "string").slice(0, 80).map(note => `<li>${e(text(note, 3000))}</li>`).join('')}</ul></section>` : '';
  const sourceHTML = sources.length ? `<section><h2 class="section-title">${L.sources}</h2><p class="source-note">${L.feedNote}</p><ol class="source-list">${sources.map((source, index) => { const url = safeURL(source.url); return `<li id="source-${index + 1}">${url ? `<a href="${e(url)}" data-source-url="${e(url)}" rel="noopener noreferrer">${e(text(source.title, 500) || source.publisher || url)}</a>` : e(text(source.title, 500))}${source.publisher ? `<p>${e(text(source.publisher, 180))}</p>` : ''}<p>${L.published}: ${e(formatDate(source.publishedAt, primaryLang, issue.timeZone))} · ${L.retrieved}: ${e(formatDate(source.retrievedAt, primaryLang, issue.timeZone, true))}</p>${url ? `<p class="source-url">${e(url)}</p>` : ''}</li>`; }).join('')}</ol></section>` : '';
  return `<!doctype html><html lang="${primaryLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(title)} · ${e(text(issue.date, 10))}</title><style>${paperStyles({ print, paperSize, palette: reading.palette, fontSize: reading.fontSize, layout: reading.layout })}</style></head><body><main class="newspaper"><header><div class="mastline"><span>A PAPER OF YOUR OWN</span><span>${L.daily}</span></div><h1 class="masthead">${e(title)}</h1><div class="folio"><span>${e(formatDate(issue.date, primaryLang, issue.timeZone))}</span><span>${L.issue} · ${e(issue.sample ? 'SAMPLE' : text(issue.id, 40))}</span><span>${e(text(issue.timeZone, 80))}</span></div>${issue.sample ? `<p class="sample-notice">${L.sample}</p>` : ''}<p class="edition-note">${L.ratio} · ${e(languageNames[langA])} ${ratio}% / ${e(languageNames[langB])} ${100 - ratio}%<br>${L.ratioNote}${!issue.sample ? `<br>${L.cutoff}: ${e(formatDate(issue.cutoffAt, primaryLang, issue.timeZone, true))} · ${L.created}: ${e(formatDate(issue.createdAt, primaryLang, issue.timeZone, true))}` : ''}</p></header>${articlesHTML || `<p>${L.noArticles}</p>`}${issueReviewHTML}${sourceHTML}${includeLeisure ? entertainmentHTML(issue, primaryLang) : ''}<footer class="bottomline">${e(title)} · ${e(issue.sample ? L.sample : issue.date)} · ${L.daily}</footer></main></body></html>`;
}
