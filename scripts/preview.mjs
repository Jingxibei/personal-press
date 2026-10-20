import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.woff2':'font/woff2', '.png':'image/png', '.svg':'image/svg+xml' };
const port = Number(process.env.PERSONAL_PRESS_PREVIEW_PORT || 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port.');
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = url.pathname === '/' ? '/renderer/index.html' : decodeURIComponent(url.pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root) || !['GET', 'HEAD'].includes(request.method) || !(await stat(file)).isFile() || !types[path.extname(file)]) throw new Error('Not found');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Offline UI preview: http://127.0.0.1:${port}/ — desktop generation and printing require npm start.`));
