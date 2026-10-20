import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { makeEpub } from '../src/core/epub.mjs';
import { makeZip } from '../src/core/archive.mjs';
import { getSampleIssue } from '../src/shared/sample.mjs';

function entries(buffer) {
  const files = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18);
    const nameSize = buffer.readUInt16LE(offset + 26);
    const extraSize = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameSize).toString();
    const start = offset + 30 + nameSize + extraSize;
    const bytes = buffer.subarray(start, start + size);
    files.set(name, { method, text:(method === 0 ? bytes : inflateRawSync(bytes)).toString() });
    offset = start + size;
  }
  return files;
}

test('EPUB contains navigable bilingual text, leisure and local calendar; reader controls body colors', () => {
  const issue = getSampleIssue();
  const files = entries(makeEpub(issue, { ratio:70 }));
  assert.equal([...files.keys()][0], 'mimetype');
  assert.deepEqual(files.get('mimetype'), { method:0, text:'application/epub+zip' });
  assert.match(files.get('META-INF/container.xml').text, /EPUB\/package.opf/);
  assert.match(files.get('EPUB/nav.xhtml').text, /leisure.xhtml/);
  assert.match(files.get('EPUB/leisure.xhtml').text, /answers.xhtml/);
  assert.ok(files.has('EPUB/answers.xhtml'));
  assert.match(files.get('EPUB/article-1.xhtml').text, /xml:lang="en"/);
  assert.match(files.get('EPUB/article-1.xhtml').text, /xml:lang="zh-CN"/);
  assert.doesNotMatch(files.get('EPUB/style.css').text, /(?:color|background|font-family)\s*:/);
});

test('untrusted article strings remain text and unsafe links are absent from EPUB', () => {
  const issue = getSampleIssue();
  issue.articles[0].bodyA = ['<script>unsafe()</script>\u0000 & detail'];
  issue.sample = false;
  issue.review = { status:'needs-attention', notes:['A source was unavailable.'] };
  issue.articles[0].review = { status:'needs-attention', notes:['<b>Conditional interpretation</b>'] };
  issue.sources = [{ id:'bad', title:'Unsafe', url:'javascript:unsafe()', publisher:'source' }];
  issue.articles[0].sourceIds = ['bad'];
  const files = entries(makeEpub(issue, { ratio:100 }));
  const article = files.get('EPUB/article-1.xhtml').text;
  assert.match(article, /&lt;script&gt;unsafe\(\)&lt;\/script&gt; &amp; detail/);
  assert.doesNotMatch(article, /<script|javascript:|\u0000|<section lang="zh-CN"/);
  assert.match(article, /needs-attention/);
  assert.match(article, /&lt;b&gt;Conditional interpretation&lt;\/b&gt;/);
  assert.match(files.get('EPUB/front.xhtml').text, /A source was unavailable\./);
  assert.throws(() => makeZip([{ name:'../outside', data:'x' }]), /path/i);
});
