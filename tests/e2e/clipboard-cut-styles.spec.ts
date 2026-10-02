// Cut, and the styles on the clipboard (specs clipboard-cut-system and copy-paste-styles): what the system clipboard
// really holds after a cut or a copy — the app's element format as text/plain and the exported markup with its CSS
// rules as text/html, with no editor attribute, node id or inline style — and what a paste of either does to the
// document the read-only test port reads.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { openMenu, runDoor, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const COPY_KEY = 'clipboard.copy#key-ctrl-c-in-global';
const CUT_KEY = 'clipboard.cut#key-ctrl-x-in-global';
const CUT_BAR = 'clipboard.cut#command-bar';
const PASTE_KEY = 'clipboard.paste#key-ctrl-v-in-global';
const COPY_STYLE_MENU = 'clipboard.copyStyle#menu-edit';
const PASTE_STYLE_MENU = 'clipboard.pasteStyle#menu-edit';
const CTRL_Z = 'history.undo#key-ctrl-z-in-global';

interface Node {
  readonly id: string;
  readonly name: string;
  readonly styles: unknown;
  readonly children: readonly Node[];
}
const heroChildren = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as { __builderTestPort: { document: () => { pages: { tree: Node }[] }; selection: () => string[] } }).__builderTestPort;
    const hero = p.document().pages[0]?.tree.children.find((c) => c.id === 'n-hero');
    return { names: hero?.children.map((c) => c.name) ?? null, selection: p.selection() };
  });
// the names the container holds, as the document the read-only test port holds them
const actionsChildren = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as { __builderTestPort: { document: () => { pages: { tree: Node }[] } } }).__builderTestPort;
    const hero = p.document().pages[0]?.tree.children.find((c) => c.id === 'n-hero');
    return hero?.children.find((c) => c.name === 'Actions')?.children.map((c) => c.name) ?? null;
  });
const stylesOf = (page: Page, id: string) =>
  page.evaluate((node) => {
    const p = (window as unknown as { __builderTestPort: { document: () => { pages: { tree: Node }[] } } }).__builderTestPort;
    const find = (n: Node): Node | null => (n.id === node ? n : (n.children.map(find).find((f) => f !== null) ?? null));
    return find(p.document().pages[0]?.tree ?? (null as unknown as Node))?.styles ?? null;
  }, id);
// what the system clipboard holds: its text/plain and its text/html, as another application reads them. The editor's
// write is asynchronous (the browser's clipboard API), so a read waits for the write to land.
const clipboard = async (page: Page): Promise<{ readonly text: string; readonly html: string; readonly css: string }> => {
  const read = () =>
    page.evaluate(async () => {
      const items = await navigator.clipboard.read().catch(() => []);
      const text: string[] = [];
      const html: string[] = [];
      const css: string[] = [];
      for (const item of items) {
        if (item.types.includes('text/plain')) text.push(await (await item.getType('text/plain')).text());
        if (item.types.includes('text/html')) html.push(await (await item.getType('text/html')).text());
        if (item.types.includes('web text/css')) css.push(await (await item.getType('web text/css')).text());
      }
      return { text: text.join('\n'), html: html.join('\n'), css: css.join('\n') };
    });
  // the clipboard arrives when the browser hands it over: a poll that returns the moment it has text, instead of a
  // loop of hundred-millisecond naps that spent five seconds every time it did (the user's direction: assert state,
  // never wait for the clock)
  await expect.poll(async () => (await read()).text !== '').toBe(true);
  return read();
};

async function openAurora(page: Page): Promise<void> {
  await openMenu(page, 'file');
  const chooser = page.waitForEvent('filechooser');
  await page.locator(`[data-door="${OPEN}"]`).click();
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-title"]')).toHaveCount(1);
}

// a real click on the canvas at the centre of a node's element: the canvas's own door (selection.select), which no
// control draws (the pointer owner reads the press)
async function clickNode(page: Page, id: string): Promise<void> {
  const at = await page.evaluate((node) => {
    const iframe = document.querySelector<HTMLIFrameElement>('.frame__page');
    const el = iframe?.contentDocument?.querySelector(`[data-node="${node}"]`);
    if (!iframe || !el) throw new Error(`the canvas does not draw ${node}`);
    const zoom = iframe.currentCSSZoom;
    const frame = iframe.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: frame.left + (r.left + r.width / 2) * zoom, y: frame.top + (r.top + r.height / 2) * zoom };
  }, id);
  await page.mouse.click(at.x, at.y);
}

test.beforeEach(async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await openAurora(page);
});

test('a cut leaves the app format and the exported markup on the system clipboard, and the paste brings the heading back', runs(OPEN, ROW, CUT_KEY, PASTE_KEY), async ({ page }) => {
  await runDoor(page, ROW, { args: { target: 'n-title' } });
  await runDoor(page, CUT_KEY);
  await expect.poll(() => heroChildren(page).then((h) => h.names)).toEqual(['Intro', 'Actions']);
  // the clipboard: text/plain in the app's element format, text/html the exported markup with its rules — no editor
  // attribute, no node id, no inline style
  const held = await clipboard(page);
  expect(JSON.parse(held.text)).toMatchObject({ format: 'builder/elements', nodes: [{ type: 'heading', name: 'Title', text: 'Welcome to Aurora' }] });
  expect(held.html).toContain('<h1');
  expect(held.html).toContain('Welcome to Aurora');
  for (const gone of ['data-node', 'data-chrome', 'style=']) expect(held.html, gone).not.toContain(gone);
  // pasting it into the empty container puts the same heading back there (the paste reads the system clipboard, so
  // the dispatch lands a moment after the key)
  await clickNode(page, 'n-actions');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __builderTestPort: { selection: () => string[] } }).__builderTestPort.selection())).toEqual(['n-actions']);
  await runDoor(page, PASTE_KEY);
  await expect.poll(() => actionsChildren(page)).toEqual(['Title']);
  // one undo takes the paste back, the second the cut: the headline is where it was
  await runDoor(page, CTRL_Z);
  await expect.poll(() => actionsChildren(page)).toEqual([]);
  await expect.poll(() => heroChildren(page).then((h) => h.names)).toEqual(['Intro', 'Actions']);
  await runDoor(page, CTRL_Z);
  await expect.poll(() => heroChildren(page).then((h) => h.names)).toEqual(['Title', 'Intro', 'Actions']);
});

test('a copy of a styled element carries its CSS rules beside the exported markup', runs(OPEN, ROW, COPY_KEY), async ({ page }) => {
  await runDoor(page, ROW, { args: { target: 'n-hero' } });
  await runDoor(page, COPY_KEY);
  const held = await clipboard(page);
  // the exported markup: the BEM class the export gives, no editor attribute, no node id, no inline style
  expect(held.html).toContain('class="hero"');
  expect(held.html).toContain('<h1');
  for (const gone of ['data-node', 'data-chrome', 'style=', '<style>']) expect(held.html, gone).not.toContain(gone);
  // the CSS rules it uses travel beside the markup (Chrome turns a <style> written with the html into inline styles,
  // so the rules have a part of their own)
  // (the export writes the box's sides as one shorthand: spec export-clean)
  expect(held.css).toMatch(/\.hero\s*\{[^}]*padding: 56px 40px/);
  // and the app's own format beside them, so the editor pastes what it copied
  expect(JSON.parse(held.text)).toMatchObject({ format: 'builder/elements', nodes: [{ type: 'section', name: 'Hero' }] });
});

test('the command bar cuts what is selected, and the toolbar keeps no other keymap', runs(OPEN, ROW, CUT_BAR), async ({ page }) => {
  await runDoor(page, ROW, { args: { target: 'n-note' } });
  await runDoor(page, CUT_BAR);
  await expect.poll(() => page.evaluate(() => {
    const p = (window as unknown as { __builderTestPort: { document: () => { pages: { tree: Node }[] } } }).__builderTestPort;
    const footer = p.document().pages[0]?.tree.children.find((c) => c.name === 'Footer');
    return footer?.children.map((c) => c.name) ?? null;
  })).toEqual([]);
});

test('Copy style and Paste style carry every style value from one element to another, one undo step', runs(OPEN, ROW, COPY_STYLE_MENU, PASTE_STYLE_MENU, CTRL_Z), async ({ page }) => {
  await runDoor(page, ROW, { args: { target: 'n-hero' } });
  await runDoor(page, COPY_STYLE_MENU);
  const held = await clipboard(page);
  expect(JSON.parse(held.text)).toMatchObject({ format: 'builder/styles', styles: { desktop: { base: { 'padding-top': '56px' } } } });
  await runDoor(page, ROW, { args: { target: 'n-card-b' } });
  await runDoor(page, PASTE_STYLE_MENU);
  // the target holds the copied styles, and the page computes them
  await expect.poll(() => stylesOf(page, 'n-card-b')).toEqual({ desktop: { base: { 'padding-top': '56px', 'padding-right': '40px', 'padding-bottom': '56px', 'padding-left': '40px' } } });
  const padding = await page.frameLocator('.frame__page').locator('[data-node="n-card-b"]').evaluate((el) => getComputedStyle(el).paddingTop);
  expect(padding).toBe('56px');
  // text and children stay, and one undo takes the styles back
  const kept = await page.evaluate(() => {
    const p = (window as unknown as { __builderTestPort: { document: () => { pages: { tree: Node }[] } } }).__builderTestPort;
    const find = (n: Node): Node | null => (n.id === 'n-card-b' ? n : (n.children.map(find).find((f) => f !== null) ?? null));
    return find(p.document().pages[0]?.tree as unknown as Node)?.children.map((c) => c.name) ?? null;
  });
  expect(kept).toEqual(['CardBTitle']);
  await runDoor(page, CTRL_Z);
  await expect.poll(() => stylesOf(page, 'n-card-b')).toEqual({});
});
