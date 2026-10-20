import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { makeZip } from '../src/core/archive.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const folder = `personal-press-${manifest.version}`;
// Deliberate allowlist: never include the developer's node_modules, repository
// metadata, user-data archives, credentials, environment files or PDF exports.
const entries = [];
async function add(relative) {
  const absolute = path.join(root, relative);
  for (const entry of (await readdir(absolute, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink() || name === 'src/assets/fonts' || /(^|\/)(\.env|credentials|user-data)(\/|$)/.test(name)) continue;
    if (entry.isDirectory()) await add(name);
    else if (entry.isFile()) entries.push({ name: `${folder}/${name}`, data: await readFile(path.join(root, name)) });
  }
}
for (const directory of ['src', 'scripts', 'test', 'docs', '.github']) await add(directory);
for (const filename of ['package.json', 'package-lock.json', '.gitignore', '.gitattributes', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'README.zh-CN.md', 'README.ja.md', 'CONTRIBUTING.md', 'SECURITY.md', 'ROADMAP.md']) entries.push({ name: `${folder}/${filename}`, data: await readFile(path.join(root, filename)) });
const data = makeZip(entries);
const output = path.join(root, 'dist', `${folder}-source.zip`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, data);
const digest = createHash('sha256').update(data).digest('hex');
await writeFile(`${output}.sha256`, `${digest}  ${path.basename(output)}\n`);
console.log(`${output}\n${entries.length} files · ${data.length} bytes\nSHA256 ${digest}`);
