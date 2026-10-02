// The Builder Companion's capture (the plan's stage 12, "abrir qualquer URL"): a browser page cannot read another
// site (CORS), so this Node process opens the address in the installed Chrome (Playwright, channel chrome), waits for
// the network to rest, scrolls to the end so lazy content loads, stops animations, and reads the page as its scripts
// left it: the DOM, every stylesheet (a linked one fetched whole, of any origin; a <style> as written), and the images,
// fonts and backgrounds they name, downloaded. With `pages` above one it follows the links to other pages of the same
// site, breadth first, up to that many pages. It hands back the files of a static copy — each page at a path like its
// address (index.html, about/index.html), css/, img/, fonts/ — every reference rewritten to them, and a link between
// two captured pages written from one file to the other: the files File › Import HTML takes (src/core/import/import.ts).
import type { Browser, Page } from '@playwright/test';
import { chromium } from '@playwright/test';

export interface CapturedFile {
  readonly path: string;
  readonly type: string;
  readonly base64: string;
}
export interface Capture {
  readonly title: string;
  readonly files: readonly CapturedFile[];
}

const TYPES: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };
const extensionOf = (url: string, type: string): string => {
  const fromPath = /\.([a-z0-9]{2,5})$/i.exec(new URL(url).pathname)?.[1]?.toLowerCase();
  if (fromPath !== undefined && fromPath in TYPES) return fromPath;
  const fromType = Object.entries(TYPES).find(([, t]) => type.startsWith(t))?.[0];
  return fromType ?? 'bin';
};
const isHttp = (url: string) => /^https?:$/.test(new URL(url).protocol);
// the most pages one capture follows
const MOST_PAGES = 30;

let shared: Browser | null = null;
async function browser(): Promise<Browser> {
  if (shared === null || !shared.isConnected()) shared = await chromium.launch({ channel: 'chrome' });
  return shared;
}
export async function closeBrowser(): Promise<void> {
  await shared?.close();
  shared = null;
}

// scrolls the page to its end and back, so lazy images and sections load, then stops every animation and transition
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}' });
}

// The project path a page of the site takes, from its address: / is index.html, /about/ about/index.html, /about
// about.html, /a.html a.html (the query and the fragment aside).
export function pagePath(url: string): string {
  const path = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
  if (path === '' || path.endsWith('/')) return `${path}index.html`;
  return /\.html?$/i.test(path) ? path : `${path}.html`;
}
// an address as a page of the site: no fragment, no query
const pageKey = (url: string): string => {
  const at = new URL(url);
  return `${at.origin}${at.pathname}`;
};
// a project path written from a page's own folder (img/a.png from about/index.html is ../img/a.png)
const fromPage = (page: string, target: string): string => '../'.repeat(page.split('/').length - 1) + target;
// a link between two pages of the project, written from one's folder to the other
function between(from: string, to: string): string {
  const base = from.split('/').slice(0, -1);
  const parts = to.split('/');
  while (base.length > 0 && parts.length > 1 && base[0] === parts[0]) {
    base.shift();
    parts.shift();
  }
  return '../'.repeat(base.length) + parts.join('/');
}

export async function capture(address: string, options: { readonly width?: number; readonly timeout?: number; readonly pages?: number } = {}): Promise<Capture> {
  const start = new URL(address);
  if (!isHttp(start.href)) throw new Error(`${address} is no http or https address`);
  const limit = Math.max(1, Math.min(options.pages ?? 1, MOST_PAGES));
  const context = await (await browser()).newContext({ viewport: { width: options.width ?? 1440, height: 900 }, locale: 'en-US' });
  try {
    const page = await context.newPage();
    const files: CapturedFile[] = [];
    const assets = new Map<string, string>();
    const sheetPaths = new Map<string, string>();
    // one asset of the site downloaded once, under its folder, by the order it was met
    const fetchAsset = async (url: string, folder: string): Promise<string | null> => {
      const known = assets.get(url);
      if (known !== undefined) return known;
      if (url.startsWith('data:')) return null;
      try {
        const response = await page.request.get(url, { timeout: 20_000 });
        if (!response.ok()) return null;
        const type = response.headers()['content-type'] ?? '';
        const path = `${folder}/${folder}-${assets.size + 1}.${extensionOf(url, type)}`;
        assets.set(url, path);
        files.push({ path, type: TYPES[extensionOf(url, type)] ?? (type.split(';')[0] ?? 'application/octet-stream'), base64: (await response.body()).toString('base64') });
        return path;
      } catch {
        return null;
      }
    };
    // a sheet with every url() it names downloaded (fonts to fonts/, the rest to img/), written from css/
    const localSheet = async (text: string, sheetUrl: string): Promise<string> => {
      let out = text;
      for (const match of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
        const raw = match[2] ?? '';
        if (raw.startsWith('data:') || raw.startsWith('#')) continue;
        const absolute = new URL(raw, sheetUrl).href;
        const font = /\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(absolute);
        const local = await fetchAsset(absolute, font ? 'fonts' : 'img');
        if (local !== null) out = out.split(match[0]).join(`url("../${local}")`);
      }
      // an @import is fetched and laid in its place
      for (const match of out.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?[^;]*;/g)) {
        const absolute = new URL(match[1] ?? '', sheetUrl).href;
        const response = await page.request.get(absolute).catch(() => null);
        const inner = response !== null && response.ok() ? await localSheet(await response.text(), absolute) : '';
        out = out.split(match[0]).join(inner);
      }
      return out;
    };
    // the pages captured, by their address, their markup still holding the link marks until the crawl ends
    const captured = new Map<string, { readonly path: string; html: string }>();
    const queue: string[] = [pageKey(start.href)];
    const queued = new Set(queue);
    let title = '';
    let inline = 0;
    while (queue.length > 0 && captured.size < limit) {
      const url = queue.shift() as string;
      let response;
      try {
        response = await page.goto(url, { waitUntil: 'load', timeout: options.timeout ?? 45_000 });
      } catch (error) {
        // the first page must open; a later one that does not is passed over
        if (captured.size === 0) throw error;
        continue;
      }
      if (captured.size > 0 && response !== null && !(response.headers()['content-type'] ?? 'text/html').includes('html')) continue;
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      await settle(page);
      const base = page.url();
      // a page that answered at an address the crawl already took (a redirect) is that page
      if (captured.has(pageKey(base))) continue;
      const path = pagePath(base);
      // what the page holds now: its markup (scripts and the settle style left out), its sheets in order, its images,
      // and its links to other pages of the site, each marked until the crawl knows which pages it took
      const read = await page.evaluate((origin) => {
        const sheets: { readonly href: string | null; readonly text: string | null }[] = [];
        for (const el of document.querySelectorAll('link[rel~="stylesheet"][href], style')) {
          if (el instanceof HTMLLinkElement) sheets.push({ href: el.href, text: null });
          else if (el.textContent !== null && !el.textContent.includes('animation-play-state:paused!important')) sheets.push({ href: null, text: el.textContent });
        }
        const clone = document.documentElement.cloneNode(true) as HTMLElement;
        for (const el of clone.querySelectorAll('script, noscript, link[rel~="stylesheet"], style, link[rel="preload"], link[rel="modulepreload"]')) el.remove();
        const images: { readonly index: number; readonly src: string }[] = [];
        clone.querySelectorAll('img').forEach((img, index) => {
          const live = document.querySelectorAll('img')[index];
          const src = (live as HTMLImageElement | undefined)?.currentSrc || img.getAttribute('src') || '';
          img.removeAttribute('srcset');
          img.removeAttribute('loading');
          img.setAttribute('src', `__capture_image_${index}__`);
          if (src !== '') images.push({ index, src: new URL(src, document.baseURI).href });
        });
        const links: string[] = [];
        clone.querySelectorAll('a[href]').forEach((a) => {
          const raw = a.getAttribute('href') ?? '';
          if (raw === '' || raw.startsWith('#') || /^(mailto|tel|javascript):/i.test(raw)) return;
          const at = new URL(raw, document.baseURI);
          if (at.origin !== origin) {
            a.setAttribute('href', at.href);
            return;
          }
          a.setAttribute('href', `__capture_link__${at.origin}${at.pathname}__${at.hash}__`);
          links.push(`${at.origin}${at.pathname}`);
        });
        return { title: document.title, html: `<!doctype html>\n${clone.outerHTML}`, sheets, images, links };
      }, start.origin);
      if (title === '') title = read.title;
      const sheetLinks: string[] = [];
      for (const sheet of read.sheets) {
        let at: string | undefined;
        if (sheet.href !== null) {
          at = sheetPaths.get(sheet.href);
          if (at === undefined) {
            const got = await page.request.get(sheet.href, { timeout: 20_000 }).catch(() => null);
            if (got === null || !got.ok()) continue;
            at = `css/style-${sheetPaths.size + 1}.css`;
            sheetPaths.set(sheet.href, at);
            files.push({ path: at, type: 'text/css', base64: Buffer.from(await localSheet(await got.text(), sheet.href), 'utf8').toString('base64') });
          }
        } else if (sheet.text !== null) {
          inline += 1;
          at = `css/inline-${inline}.css`;
          files.push({ path: at, type: 'text/css', base64: Buffer.from(await localSheet(sheet.text, base), 'utf8').toString('base64') });
        }
        if (at !== undefined) sheetLinks.push(`<link rel="stylesheet" href="${fromPage(path, at)}">`);
      }
      let html = read.html;
      for (const image of read.images) {
        const local = await fetchAsset(image.src, 'img');
        html = html.split(`__capture_image_${image.index}__`).join(local === null ? image.src : fromPage(path, local));
      }
      // an image that named no source keeps none
      html = html.replace(/__capture_image_\d+__/g, '');
      // inline style="background-image:url(…)" of the markup, downloaded too
      for (const match of html.matchAll(/url\(\s*(?:&quot;|['"])?([^'")&]+)(?:&quot;|['"])?\s*\)/g)) {
        const raw = match[1] ?? '';
        if (raw.startsWith('data:') || raw.startsWith('__capture')) continue;
        const local = await fetchAsset(new URL(raw, base).href, 'img');
        if (local !== null) html = html.split(match[0]).join(`url(${fromPage(path, local)})`);
      }
      // the mark of a captured page: the import keeps what the model does not hold of its sheets (spec capture-url)
      const mark = `<meta name="builder-capture" content="${base.replaceAll('"', '&quot;')}">`;
      html = html.replace(/<head([^>]*)>/i, `<head$1>\n${mark}\n${sheetLinks.join('\n')}`);
      captured.set(pageKey(base), { path, html });
      for (const link of read.links) {
        if (queued.has(link)) continue;
        queued.add(link);
        queue.push(link);
      }
    }
    // a link to a page the crawl took is written to that page's file; any other keeps its address
    for (const [, one] of captured) {
      one.html = one.html.replace(/__capture_link__(.*?)__(#[^"]*?)?__/g, (_all, url: string, hash: string | undefined) => {
        const target = captured.get(url);
        return `${target === undefined ? url : between(one.path, target.path)}${hash ?? ''}`;
      });
    }
    const pages = [...captured.values()].map((one): CapturedFile => ({ path: one.path, type: 'text/html', base64: Buffer.from(one.html, 'utf8').toString('base64') }));
    return { title, files: [...pages, ...files] };
  } finally {
    await context.close();
  }
}
