import { createHash } from 'node:crypto';
import { makeZip } from './archive.mjs';

const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[char]);
const paragraphs = lines => (Array.isArray(lines) ? lines : []).map(line => `<p>${xml(line)}</p>`).join('');
function link(url) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; }
  catch { return ''; }
}
const css = `body{font-size:1em}h1,h2,h3{text-align:left}article{page-break-before:always}a{text-decoration:underline}aside{margin-top:1em}table{border-collapse:collapse;page-break-inside:avoid}td,th{border:1px solid;padding:.3em;text-align:center}blockquote{margin:1em}section[lang]{margin-bottom:1.5em}.sudoku td:nth-child(3n){border-right:3px solid}.sudoku tr:nth-child(3n) td{border-bottom:3px solid}.sudoku{border:3px solid}.block{border:3px solid}small{font-size:.6em}`;
const localText = (value, language) => typeof value === 'string' ? value : value?.[language] || value?.en || '';
const reviewNotes = review => !review ? '' : `<aside><h2>Review notes / 审读记录 / 確認記録</h2><p>${xml(review.status)}</p><ul>${(Array.isArray(review.notes) ? review.notes : []).filter(note => typeof note === 'string').map(note => `<li>${xml(note)}</li>`).join('')}</ul></aside>`;
function gridTable(grid, { sudoku = false, clues } = {}) {
  if (!Array.isArray(grid) || !grid.length || grid.length > 15 || grid.some(row => !Array.isArray(row) || row.length > 15)) return '';
  const numbers = new Map([...(clues?.across || []), ...(clues?.down || [])].map(clue => [`${clue.row}:${clue.col}`, clue.number]));
  return `<table${sudoku ? ' class="sudoku"' : ''}><tbody>${grid.map((row,r) => `<tr>${row.map((cell,c) => `<td${cell === '#' ? ' class="block"' : ''}>${numbers.has(`${r}:${c}`) && cell !== '#' ? `<small>${xml(numbers.get(`${r}:${c}`))} </small>` : ''}${cell === '#' ? '×' : cell === 0 || cell === '' ? '&#160;' : xml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function leisurePage(issue, language) {
  const data = issue.entertainment || {}, content = [];
  if (data.sudoku?.grid) content.push(`<section><h2>${xml(localText(data.sudoku.title, language))}</h2>${gridTable(data.sudoku.grid, { sudoku:true })}</section>`);
  if (data.crossword?.grid) {
    const game = data.crossword;
    content.push(`<section><h2>${xml(localText(game.title, language))}</h2><p>${xml(localText(game.note, language))}</p>${gridTable(game.grid, { clues:game.clues })}${['across','down'].map(direction => `<h3>${direction === 'across' ? 'Across / 横向 / 横' : 'Down / 纵向 / 縦'}</h3><ul>${(game.clues?.[direction] || []).map(clue => `<li>${xml(clue.number)}. ${xml(localText(clue.clue, language))}</li>`).join('')}</ul>`).join('')}</section>`);
  }
  if (data.riddle?.question) content.push(`<section><h2>Riddle / 谜语 / なぞなぞ</h2><p>${xml(localText(data.riddle.question, language))}</p></section>`);
  if (data.joke?.text) content.push(`<section><h2>A little levity / 一点幽默 / 小さな笑い</h2><p>${xml(localText(data.joke.text, language))}</p></section>`);
  if (!content.length) return '';
  return `<h1>Leisure / 闲暇副刊 / ひと休み</h1><p>${xml(localText(data.notice, language))}</p>${content.join('')}<p><a href="answers.xhtml">Answers / 参考答案 / 答え</a></p>`;
}
function answersPage(issue, language) {
  const data = issue.entertainment || {};
  return `<h1>Answers / 参考答案 / 答え</h1>${data.sudoku ? `<h2>${xml(localText(data.sudoku.title, language))}</h2>${gridTable(data.sudoku.solution, { sudoku:true })}` : ''}${data.crossword ? `<h2>${xml(localText(data.crossword.title, language))}</h2>${gridTable(data.crossword.solution, { clues:data.crossword.clues })}` : ''}${data.riddle ? `<h2>Riddle / 谜语 / なぞなぞ</h2><p>${xml(localText(data.riddle.answer, language))}</p>` : ''}`;
}

/** A reflowable EPUB 3: reader controls body font, foreground and background. */
export function makeEpub(issue, reading = {}) {
  const identity = createHash('sha256').update(JSON.stringify(issue)).digest('hex');
  const uid = `urn:sha256:${identity}`;
  const languageA = issue.languageA || 'en', languageB = issue.languageB || 'zh-CN';
  const ratio = Number.isFinite(reading.ratio) ? reading.ratio : issue.ratio ?? 70;
  const primaryLanguage = ratio >= 50 ? languageA : languageB;
  const navEntries = [], articles = [];
  for (const [index, article] of (issue.articles || []).entries()) {
    const filename = `article-${index + 1}.xhtml`;
    const title = ratio >= 50 ? article.titleA : article.titleB;
    navEntries.push(`<li><a href="${filename}">${xml(title)}</a></li>`);
    const blocks = [];
    const languageBlocks = [['A', languageA, ratio > 0], ['B', languageB, ratio < 100]];
    if (ratio < 50) languageBlocks.reverse();
    for (const [suffix, language, visible] of languageBlocks) {
      if (!visible) continue;
      blocks.push(`<section lang="${xml(language)}" xml:lang="${xml(language)}"><h1>${xml(article[`title${suffix}`])}</h1><p>${xml(article[`summary${suffix}`])}</p>${paragraphs(article[`body${suffix}`])}<aside><p>${xml(article[`implications${suffix}`])}</p><p>${xml(article[`uncertainties${suffix}`])}</p></aside></section>`);
    }
    const references = (article.sourceIds || []).map(id => (issue.sources || []).find(source => source.id === id)).filter(Boolean);
    blocks.push(`<aside><h2>Sources / 来源 / 出典</h2><ol>${references.map(source => `<li>${link(source.url) ? `<a href="${xml(link(source.url))}">${xml(source.title)}</a>` : xml(source.title)} — ${xml(source.publisher)} · ${xml(source.publishedAt)}</li>`).join('')}</ol></aside>`);
    if (!issue.sample) blocks.push(reviewNotes(article.review));
    articles.push({ name: `EPUB/${filename}`, data: document(title, blocks.join(''), primaryLanguage) });
  }
  const calendar = (issue.calendar || []).map(event => `<li>${xml(event.time)} ${xml(event.title)}</li>`).join('');
  if (calendar) {
    navEntries.push('<li><a href="calendar.xhtml">Calendar / 行事历 / 予定</a></li>');
    articles.push({ name: 'EPUB/calendar.xhtml', data: document('Calendar / 行事历 / 予定', `<h1>Calendar / 行事历 / 予定</h1><ul>${calendar}</ul>`, languageA) });
  }
  const leisure = leisurePage(issue, primaryLanguage);
  if (leisure) {
    navEntries.push('<li><a href="leisure.xhtml">Leisure / 闲暇副刊 / ひと休み</a></li>');
    articles.push({ name:'EPUB/leisure.xhtml', data:document('Leisure / 闲暇副刊 / ひと休み', leisure, primaryLanguage) });
    articles.push({ name:'EPUB/answers.xhtml', data:document('Answers / 参考答案 / 答え', answersPage(issue, primaryLanguage), primaryLanguage) });
  }
  const front = `<h1>${xml(issue.title)}</h1><p>${xml(issue.date)} · ${xml(issue.timeZone)}</p>${issue.sample ? '<p>DEMONSTRATION / 演示内容 / サンプル</p>' : ''}<p>Content cutoff / 内容截止 / 情報締切: ${xml(issue.cutoffAt)}</p><p>Automatic review is not independent factual verification. / 自动审核不等于独立事实核验。 / 自動審査は独立した事実確認ではありません。</p>${!issue.sample ? reviewNotes(issue.review) : ''}`;
  const nav = document(issue.title, `<nav epub:type="toc" id="toc"><h1>${xml(issue.title)}</h1><ol><li><a href="front.xhtml">${xml(issue.date)}</a></li>${navEntries.join('')}</ol></nav>`, languageA);
  const names = ['front.xhtml', ...articles.map(article => article.name.slice(5))];
  const modified = new Date(issue.createdAt || `${issue.date}T00:00:00Z`).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const opf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">${uid}</dc:identifier><dc:title>${xml(issue.title)} — ${xml(issue.date)}</dc:title><dc:language>${xml(languageA)}</dc:language><dc:language>${xml(languageB)}</dc:language><meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="style" href="style.css" media-type="text/css"/>${names.map((name, index) => `<item id="p${index}" href="${name}" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${names.map((_, index) => `<itemref idref="p${index}"/>`).join('')}</spine></package>`;
  return makeZip([
    { name: 'mimetype', data: 'application/epub+zip', store: true },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: 'EPUB/package.opf', data: opf }, { name: 'EPUB/nav.xhtml', data: nav },
    { name: 'EPUB/style.css', data: css }, { name: 'EPUB/front.xhtml', data: document(issue.title, front, languageA) }, ...articles
  ]);
}
function document(title, content, language) {
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xml(language)}" lang="${xml(language)}"><head><meta charset="utf-8"/><title>${xml(title)}</title><link rel="stylesheet" href="style.css"/></head><body>${content}</body></html>`;
}
