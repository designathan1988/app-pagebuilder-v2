// Opening a web address (spec capture-url): the Builder Companion, started here as `npm run companion` starts it,
// captures a local site whose script adds a paragraph after load, whose stylesheet names a background image and whose
// page shows an image; the editor's File › Open a web address… sends the address, and the page arrives through Import
// HTML as its script left it, with its classes, colours, image and background files.
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Server as CompanionServer } from 'node:http';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { runDoor, runs, openExplorer } from './door.ts';
import { startCompanion, stopCompanion } from '../../tools/companion/server.ts';

const SITE_PORT = 5421;
// one site and one Companion for the file's tests: they run one after the other
test.describe.configure({ mode: 'serial' });
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' };
let site: Server;
let companion: CompanionServer;

test.beforeAll(async () => {
  site = createServer((req, res) => {
    // a folder's address is its index.html, as a web server serves it
    const asked = (req.url ?? '/').split('?')[0] ?? '/';
    const file = join('tests/support/capture-site', asked.endsWith('/') ? `${asked}index.html` : asked);
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => site.listen(SITE_PORT, '127.0.0.1', () => resolve()));
  companion = await startCompanion(5410);
});
test.afterAll(async () => {
  await stopCompanion(companion);
  await new Promise((resolve) => site.close(resolve));
});

type Doc = { pages: { file: string; tree: unknown }[]; files?: { path: string }[]; classes?: { name: string }[] };
const read = (page: Page) => page.evaluate(() => (window as unknown as { __builderTestPort: { document(): Doc } }).__builderTestPort.document());

test('a web address is captured as its script left it and imported as a page', runs('workspace.openDialog#menu-file-capture-url', 'project.captureUrl#capture-url-run'), async ({ page }) => {
  test.setTimeout(120_000);
  await openEditor(page);
  await runDoor(page, 'workspace.openDialog#menu-file-capture-url');
  const dialog = page.locator('[data-region="capture-url-dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="url"]').fill(`127.0.0.1:${SITE_PORT}/`);
  await dialog.locator('[data-door="project.captureUrl#capture-url-run"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText(/Capturing http:\/\/127\.0\.0\.1:5421\//);
  // the import's own destinations, then a new page
  const destination = page.locator('[data-door="project.importHtml#destination-page"]');
  await expect(destination).toBeVisible({ timeout: 60_000 });
  await destination.click();
  const frame = page.frameLocator('.frame__page');
  await expect(frame.getByRole('heading', { name: 'Grão Norte' })).toBeVisible();
  // what the site's script added after load is there
  await expect(frame.getByText('Added by a script')).toBeVisible();
  // a web component's shadow DOM is flattened: its slot holds the light text, its own text and style come with it
  await expect(frame.getByText('Fresh beans')).toBeVisible();
  expect(await frame.getByText('Fresh beans').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(185, 81, 42)');
  // the stylesheet's rules, as classes: the brand colour, the lead's colour of the <style>
  expect(await frame.getByRole('heading', { name: 'Grão Norte' }).evaluate((el) => getComputedStyle(el).color)).toBe('rgb(245, 230, 211)');
  expect(await frame.getByText('Fresh coffee, roasted every week.').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(122, 62, 29)');
  // the image and the background were downloaded into the project
  const doc = await read(page);
  expect((doc.files ?? []).filter((f) => f.path.startsWith('img/')).length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => frame.locator('img').first().evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test('two pages of the site are captured, the link between them written from one file to the other', runs('project.captureUrl#capture-url-run'), async ({ page }) => {
  test.setTimeout(120_000);
  await openEditor(page);
  await runDoor(page, 'workspace.openDialog#menu-file-capture-url');
  const dialog = page.locator('[data-region="capture-url-dialog"]');
  await dialog.locator('input[name="url"]').fill(`127.0.0.1:${SITE_PORT}/`);
  await dialog.locator('input[name="pages"]').fill('2');
  await dialog.locator('[data-door="project.captureUrl#capture-url-run"]').click();
  const destination = page.locator('[data-door="project.importHtml#destination-page"]');
  await expect(destination).toBeVisible({ timeout: 60_000 });
  await destination.click();
  await expect.poll(async () => (await read(page)).pages.map((one) => one.file).sort()).toEqual(['index.html', 'plans/index.html']);
  const frame = page.frameLocator('.frame__page');
  await expect(frame.getByRole('link', { name: 'See the plans' })).toHaveAttribute('href', 'plans/index.html');
  const plans = (await read(page)).pages.find((one) => one.file === 'plans/index.html');
  await openExplorer(page);
  await runDoor(page, 'pages.switch#explorer-page-row', { args: { page: (plans?.tree as { id: string }).id } });
  await expect(frame.getByRole('heading', { name: 'Our plans' })).toBeVisible();
  // the shared stylesheet reached the second page too
  expect(await frame.getByRole('heading', { name: 'Our plans' }).evaluate((el) => getComputedStyle(el).color)).toBe('rgb(245, 230, 211)');
  // the links between the two pages name the project's pages (the export writes them from each page's folder)
  const hrefs = await page.evaluate(() => {
    const port = (window as unknown as { __builderTestPort: { document(): { pages: { tree: unknown }[] } } }).__builderTestPort;
    const found: Record<string, unknown> = {};
    const walk = (n: { text?: string | null; attributes?: { href?: unknown }; children?: unknown[] }) => {
      if (typeof n.text === 'string') found[n.text] = n.attributes?.href;
      for (const child of n.children ?? []) walk(child as never);
    };
    for (const one of port.document().pages) walk(one.tree as never);
    return found;
  });
  expect(hrefs['See the plans']).toBe('plans/index.html');
  expect(hrefs['Back home']).toBe('index.html');
});

test('without the Companion the status bar says how to start it', runs('project.captureUrl#capture-url-run'), async ({ page }) => {
  await stopCompanion(companion);
  try {
    await openEditor(page);
    await runDoor(page, 'workspace.openDialog#menu-file-capture-url');
    const dialog = page.locator('[data-region="capture-url-dialog"]');
    await dialog.locator('input[name="url"]').fill('https://example.com');
    await dialog.locator('[data-door="project.captureUrl#capture-url-run"]').click();
    await expect(page.getByRole('status')).toHaveText('The Builder Companion does not answer: run npm run companion, then capture again.');
  } finally {
    companion = await startCompanion(5410);
  }
});
