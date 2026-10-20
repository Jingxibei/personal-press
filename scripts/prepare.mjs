import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// Electron's npm package exposes an explicit installer. Source installations
// need its platform runtime before `npm start` can work.
execFileSync(process.execPath, [path.join(root, 'node_modules/electron/install.js')], { cwd: root, stdio: 'inherit' });
await import('./prepare-fonts.mjs');
