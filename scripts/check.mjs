import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'assets') continue;
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(name));
    else if (/\.(mjs|cjs|js)$/.test(entry.name)) paths.push(name);
  }
  return paths;
}
const files = (await Promise.all(['src', 'scripts', 'test'].map(name => walk(path.join(root, name))))).flat();
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
if (lock.packages[''].version !== manifest.version) throw new Error('Lockfile version is stale.');
for (const field of ['dependencies', 'devDependencies']) if (JSON.stringify(lock.packages[''][field]) !== JSON.stringify(manifest[field])) throw new Error(`Lockfile ${field} differ from package.json.`);
const html = await readFile(path.join(root, 'src/renderer/index.html'), 'utf8');
if (!html.includes('Content-Security-Policy') || /<script\b[^>]+src=["']https?:/i.test(html)) throw new Error('The local reader must declare CSP and use only bundled scripts.');
console.log(`Syntax, local-reader policy and lockfile checks passed (${files.length} JavaScript files).`);
