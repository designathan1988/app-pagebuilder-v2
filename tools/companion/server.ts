// The Builder Companion (the plan's stage 12; `npm run companion`): a local HTTP server, on this machine only
// (127.0.0.1, COMPANION_PORT, 5410 by default), that the editor asks to capture a web address it cannot read itself.
//   GET  /health  → { ok: true }
//   POST /capture { url, pages? } → { title, files: [{ path, type, base64 }] }, or { error } with status 400 or 502
//   (pages: how many pages of the site to follow, from the address, 1 by default)
// The editor's page may call it from its own origin (CORS allows any origin: the server answers this machine only).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { capture, closeBrowser } from './capture.ts';

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' });
  res.end(JSON.stringify(body));
};
const bodyOf = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      text += chunk;
      if (text.length > 100_000) reject(new Error('the request is too large'));
    });
    req.on('end', () => resolve(text));
    req.on('error', reject);
  });

export function startCompanion(port = Number(process.env.COMPANION_PORT ?? '5410')): Promise<Server> {
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'OPTIONS') return json(res, 204, {});
      if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
      if (req.method !== 'POST' || req.url !== '/capture') return json(res, 404, { error: 'not found' });
      let url: string;
      let pages = 1;
      try {
        const parsed = JSON.parse(await bodyOf(req)) as { url?: unknown; pages?: unknown };
        if (typeof parsed.url !== 'string') throw new Error('no url');
        url = new URL(parsed.url).href;
        if (typeof parsed.pages === 'number' && Number.isInteger(parsed.pages) && parsed.pages > 0) pages = parsed.pages;
      } catch {
        return json(res, 400, { error: 'the request names no address' });
      }
      try {
        return json(res, 200, await capture(url, { pages }));
      } catch (error) {
        return json(res, 502, { error: (error as Error).message.split('\n')[0] });
      }
    })();
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export async function stopCompanion(server: Server): Promise<void> {
  await new Promise((resolve) => server.close(resolve));
  await closeBrowser();
}

// run directly: npm run companion
if (process.argv[1]?.replaceAll('\\', '/').endsWith('tools/companion/server.ts')) {
  void startCompanion().then((server) => {
    const at = server.address();
    console.log(`Builder Companion on http://127.0.0.1:${typeof at === 'object' && at !== null ? at.port : '?'} — Ctrl+C stops it`);
  });
}
