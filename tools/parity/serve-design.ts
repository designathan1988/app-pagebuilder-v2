// The canonical design served from the project's folder on 5394 (its i18n catalogue does not load from file://, which
// blocks it by CORS): what the parity tools compare the app with.
//   node tools/parity/serve-design.ts
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve('.');
const PORT = Number(process.env.DESIGN_PORT ?? 5394);
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
createServer((request, response) => {
  const asked = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
  const file = normalize(join(ROOT, asked));
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  response.end(readFileSync(file));
}).listen(PORT, () => console.log(`the canonical design on http://localhost:${PORT}/design/final/index.html`));
