import { mkdir, readFile, readdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'src/assets/fonts');
const packages = {
  sc: '@fontsource-variable/noto-serif-sc',
  jp: '@fontsource-variable/noto-serif-jp',
  caslon: '@fontsource/libre-caslon-display'
};
await mkdir(target, { recursive: true });
const styles = [];
for (const [short, name] of Object.entries(packages)) {
  const source = path.join(root, 'node_modules', name);
  const css = (await readFile(path.join(source, 'index.css'), 'utf8'))
    .replaceAll('Noto Serif SC Variable', 'Noto Serif SC')
    .replaceAll('Noto Serif JP Variable', 'Noto Serif JP')
    .replaceAll('url(./files/', `url(./${short}/`);
  styles.push(css);
  const folder = path.join(target, short);
  await mkdir(folder, { recursive: true });
  const referenced = new Set([...css.matchAll(/url\(\.\/[^/]+\/([^)'"\s]+)\)/g)].map(match => match[1]));
  for (const file of referenced) {
    await copyFile(path.join(source, 'files', file), path.join(folder, file));
  }
  for (const file of await readdir(source)) {
    if (/^(license|ofl)(\.txt|\.md)?$/i.test(file)) await copyFile(path.join(source, file), path.join(folder, file));
  }
}
await writeFile(path.join(target, 'fonts.css'), styles.join('\n'), 'utf8');
console.log('Prepared local Latin, Chinese and Japanese newspaper fonts.');
