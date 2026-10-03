// The status bar (spec status-bar; the audit's A3.20): the breadcrumb of the selection, each ancestor a button that
// selects it, the size of the selection in page pixels, the breakpoint and the state, the element count, the zoom and
// the save state. The end artifacts are what the bar says beside what the page really measures (the element's own box
// inside the frame, the document through the read-only test port), never a readout of the bar's own making.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs, openExplorer } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const CLICK = 'selection.select#canvas-click-element-or-page';
const CRUMB = 'selection.select#status-bar-breadcrumb-item';
const WIDTH = 'style.set#inspector-width';
const PHONE = 'view.setBreakpoint#toolbar-breakpoint-tabs-phone';
const HOVER = 'view.setStyleState#menu-style-state-hover';

const selection = (page: Page) => page.evaluate(() => (window as unknown as { __builderTestPort: { selection: () => string[] } }).__builderTestPort.selection());

// the screen box of a node's element, through the frame's CSS zoom, and its box in page pixels (the frame's own
// coordinates: the width and height the bar reads)
function boxOf(page: Page, id: string): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly page: { readonly width: number; readonly height: number } }> {
  return page.evaluate((node) => {
    const iframe = document.querySelector<HTMLIFrameElement>('.frame__page');
    const el = iframe?.contentDocument?.querySelector(`[data-node="${node}"]`);
    if (!iframe || !el) throw new Error(`the canvas does not draw ${node}`);
    const zoom = iframe.currentCSSZoom;
    const frame = iframe.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: frame.left + r.left * zoom, y: frame.top + r.top * zoom, width: r.width * zoom, height: r.height * zoom, page: { width: Math.round(r.width), height: Math.round(r.height) } };
  }, id);
}

async function clickNode(page: Page, id: string): Promise<void> {
  const box = await boxOf(page, id);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

const crumbs = (page: Page) => page.locator('.status-bar__breadcrumb .status-bar__crumb').allInnerTexts();
const size = (page: Page) => page.locator('.status-bar .status-bar__size').innerText();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-hero"]')).toHaveCount(1);
});

test('the bar shows the path, the size, the context, the count and the zoom of what is selected', runs(OPEN, CLICK), async ({ page }) => {
  await clickNode(page, 'n-intro');
  await expect.poll(() => selection(page)).toEqual(['n-intro']);
  // the path: the page root down to the selected node, each crumb naming its node
  expect(await crumbs(page)).toEqual(['Page', 'Hero', 'Intro']);
  // the size: the numbers the page really measures for the node, in page pixels
  const intro = await boxOf(page, 'n-intro');
  expect(await size(page)).toBe(`${intro.page.width} × ${intro.page.height}`);
  await expect(page.locator('.status-bar .status-bar__context')).toHaveText('Desktop / Base');
  // the count: the elements of the page on the canvas (the project has one page here)
  const nodes = await page.evaluate(() => {
    const count = (node: { children: unknown[] }): number => 1 + node.children.reduce((sum: number, child) => sum + count(child as { children: unknown[] }), 0);
    const doc = (window as unknown as { __builderTestPort: { document: () => { pages: { tree: { children: unknown[] } }[] } } }).__builderTestPort.document();
    return doc.pages[0] === undefined ? 0 : count(doc.pages[0].tree);
  });
  await expect(page.locator('.status-bar').getByText(nodes === 1 ? '1 element' : `${nodes} elements`)).toHaveCount(1);
  // the zoom, and the save state of the work the editor stored
  await expect(page.locator('.status-bar .zoom-value')).toHaveText(/%$/);
  await expect.poll(() => page.locator('[data-save-state]').getAttribute('data-save-state')).toBe('saved');
});

test('a click on a crumb selects the ancestor it names, and the bar follows', runs(OPEN, CLICK, CRUMB), async ({ page }) => {
  await clickNode(page, 'n-card-a-title');
  await expect.poll(() => selection(page)).toEqual(['n-card-a-title']);
  expect(await crumbs(page)).toEqual(['Page', 'Plans', 'Grid', 'CardA', 'CardATitle']);
  await control(page, CRUMB, { args: { target: 'n-grid' } }).click();
  await expect.poll(() => selection(page)).toEqual(['n-grid']);
  const grid = await boxOf(page, 'n-grid');
  await expect.poll(() => size(page)).toBe(`${grid.page.width} × ${grid.page.height}`);
  expect(await crumbs(page)).toEqual(['Page', 'Plans', 'Grid']);
});

test('the size and the context follow the commands', runs(OPEN, CLICK, WIDTH, PHONE, HOVER), async ({ page }) => {
  await clickNode(page, 'n-intro');
  await expect.poll(() => selection(page)).toEqual(['n-intro']);
  await control(page, WIDTH).locator('input').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('200');
  await page.keyboard.press('Enter');
  const intro = await boxOf(page, 'n-intro');
  expect(intro.page.width, 'the page took the width').toBe(200);
  await expect.poll(() => size(page)).toBe(`${intro.page.width} × ${intro.page.height}`);
  await runDoor(page, PHONE);
  await expect(page.locator('.status-bar .status-bar__context')).toHaveText('Phone / Base');
  await runDoor(page, HOVER);
  await expect(page.locator('.status-bar .status-bar__context')).toHaveText('Phone / Hover');
});

// The bar's controls are as tall as the bar (the audit's U-038: 26 and 28 px buttons in a 24 px bar).
test('every control of the status bar is as tall as the bar', runs(OPEN, CLICK), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  // a press on the page selects it: the breadcrumb draws its button
  await page.mouse.click(700, 400);
  await expect(page.locator(`[data-door="${CRUMB}"]`)).not.toHaveCount(0);
  const heights = await page.locator('footer.status-bar').evaluate((bar) => ({ bar: Math.round(bar.getBoundingClientRect().height), controls: [...bar.querySelectorAll('button')].filter((b) => b.getClientRects().length > 0).map((b) => Math.round(b.getBoundingClientRect().height)) }));
  expect(heights.controls.length).toBeGreaterThan(2);
  expect(heights.controls.every((h) => h <= heights.bar), JSON.stringify(heights)).toBe(true);
});

// While the dock is closed its strip stays (design/final): its Checks tab carries the number of issues the document
// has, as a badge and in its name (plan 5.5, spec dock-toggles), the strip says the first issue, and the tab opens the
// dock on the list.
test('the Checks tab of the closed dock says how many issues the document has and opens the dock on them', runs(OPEN, 'workspace.setPanelOpen#dock-strip-checks'), async ({ page }) => {
  // (the aurora project is open: beforeEach)
  const icon = page.locator('[data-door="workspace.setPanelOpen#dock-strip-checks"]');
  const name = (await icon.getAttribute('aria-label')) ?? '';
  const count = Number(/(\d+)/.exec(name)?.[1] ?? 'NaN');
  expect(name).toMatch(/^Checks: \d+ issues?$/);
  if (count > 0) await expect(page.locator('.dock-strip__badge')).toHaveText(String(count));
  else await expect(page.locator('.dock-strip__badge')).toHaveCount(0);
  if (count > 0) await expect(page.locator('.dock-strip__peek')).toHaveText(/ · /);
  // the status bar draws no dock panel any more
  await expect(page.locator('footer.status-bar [data-door^="workspace.setPanelOpen"]')).toHaveCount(0);
  await icon.click();
  // the open dock's Checks tab keeps the count, in its name too
  const tab = page.locator('[data-region="tab-strip"] [role="tab"][aria-selected="true"]');
  await expect(tab.locator('.door__label')).toHaveText('Checks');
  await expect(tab).toHaveAttribute('aria-label', name);
  await expect(page.locator('.dock-checks__list li, .dock-checks__none')).not.toHaveCount(0);
});

test('the element count is that of the open page: a new page reads one element', runs(OPEN, 'pages.add#explorer-add-page'), async ({ page }) => {
  // the dogfooding pass: a new empty page read "20 elements", the count of every page of the project (the aurora project
  // is open: beforeEach)
  await expect(page.locator('.status-bar').getByText('19 elements')).toHaveCount(1);
  await openExplorer(page);
  await runDoor(page, 'pages.add#explorer-add-page');
  await expect(page.locator('.status-bar').getByText('1 element', { exact: true })).toHaveCount(1);
});
