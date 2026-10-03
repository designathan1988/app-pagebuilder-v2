// The jornada03 study's findings (jornada03/REPORT.md, J1–J28) replayed where no other test replays the persona's
// path: each test drives the path that met the problem and asserts the outcome the fix gives. Every J is held to a test
// by tests/e2e/jornada03.json (the test that replays it here, in another spec, a scenario or a unit test), checked by
// tools/inventory/jornada03.test.ts.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, openExplorer, openStyleControl, runDoor, runs } from './door.ts';

const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const INSERT_PANEL = 'workspace.setPanelOpen#toolbar-activity-bar-insert';
const TILE = 'element.insert#elements-tile';

type Node = { id: string; name: string; type: string; text: string | null; attributes: Record<string, unknown>; styles: Record<string, Record<string, Record<string, string>> | undefined>; children: Node[] };
type Port = { document(): { pages: { name: string; file: string; tree: Node }[] }; incidents(): unknown[] };
const port = (page: Page) => page.evaluate(() => {
  const p = (window as unknown as { __builderTestPort: Port }).__builderTestPort;
  return { document: p.document(), incidents: p.incidents() };
});
const find = (node: Node, id: string): Node | undefined => (node.id === id ? node : node.children.map((child) => find(child, id)).find((found) => found !== undefined));

async function openProject(page: Page, name: string, json: string): Promise<void> {
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.frameLocator('.frame__page').locator('[data-node]').first()).toBeAttached();
}
const openFixture = (page: Page, id: string) => openProject(page, `${id}.json`, fs.readFileSync(`manifest/features/fixtures/${id}.json`, 'utf8'));
async function typeInto(page: Page, field: import('@playwright/test').Locator, value: string): Promise<void> {
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}

// J1 (D1): style.setBorder with var(--line) wrote the composite border-color, which the model refused: nothing was
// published and the person saw nothing. A token in a one-value-per-side composite is written into each longhand, and
// nothing reaches the incident feed.
test('J1: a variable typed as a border colour reaches every side, and nothing fails in silence', runs(OPEN, ROW, 'style.setBorder#inspector-border-color-border-editor'), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, 'brand-title');
  await openExplorer(page);
  await control(page, ROW, { args: { target: 'n-title' } }).click();
  await openStyleControl(page, 'style.setBorder#inspector-border-color-border-editor');
  await typeInto(page, page.locator('[data-door="style.setBorder#inspector-border-color-border-editor"] input').first(), 'var(--brand)');
  await expect.poll(async () => {
    const title = find((await port(page)).document.pages[0]?.tree as Node, 'n-title');
    const base = title?.styles.desktop?.base ?? {};
    return ['top', 'right', 'bottom', 'left'].map((side) => base[`border-${side}-color`]);
  }).toEqual(['var(--brand)', 'var(--brand)', 'var(--brand)', 'var(--brand)']);
  expect((await port(page)).incidents, 'no incident').toEqual([]);
});

// J5 (D1, D2): the Styles view did not scroll — the variables ran under Layers, and clicks there floated Layers. The
// view scrolls its own list, and the Layers section stays where it is.
test('J5: a long variables list scrolls inside the Styles view and leaves the Layers where they are', runs(OPEN, 'workspace.setPanelOpen#toolbar-activity-bar-styles'), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  const project = JSON.parse(fs.readFileSync('manifest/features/fixtures/aurora.json', 'utf8'));
  project.tokens = Array.from({ length: 40 }, (_, i) => ({ name: `tone-${i + 1}`, kind: 'color', value: `#${(0x102030 + i * 0x030303).toString(16).padStart(6, '0')}` }));
  await openProject(page, 'tones.json', JSON.stringify(project));
  await runDoor(page, 'workspace.setPanelOpen#toolbar-activity-bar-styles');
  const view = page.locator('[data-region="styles"]');
  await expect(view).toBeVisible();
  const layers = await page.locator('[data-region="explorer-layers"]').boundingBox();
  // the list is longer than its view: the wheel over it scrolls it, and its last variable comes into view
  const box = await view.boundingBox();
  if (box === null) throw new Error('the Styles view is not laid out');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 4000);
  const last = view.locator('.variables__row').last();
  await expect(last.locator('input').first()).toHaveValue('tone-40');
  await expect(last).toBeInViewport();
  const lastBox = await last.boundingBox();
  expect(lastBox !== null && lastBox.y + lastBox.height <= box.y + box.height + 1, 'the last variable stands inside the view, not under the Layers').toBe(true);
  // a press in the list leaves the Layers docked where they were
  await last.locator('.variables__swatch').click();
  expect(await page.locator('[data-region="explorer-layers"]').boundingBox()).toEqual(layers);
});

// J15 (M4): the font list was cut on the left. The values menu floats on the window, whole and inside it.
test('J15: the font menu is drawn whole inside the window', runs(OPEN, ROW, 'style.set#inspector-font-family'), async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFixture(page, 'aurora');
  await openExplorer(page);
  await control(page, ROW, { args: { target: 'n-title' } }).click();
  await openStyleControl(page, 'style.set#inspector-font-family');
  const family = page.locator('[data-door="style.set#inspector-font-family"]').first();
  await family.scrollIntoViewIfNeeded();
  await family.locator('.field__values-button').click();
  const menu = page.locator('.field__menu[role="menu"]').last();
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  if (box === null) throw new Error('the font menu is not laid out');
  expect(box.x, 'not cut on the left').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'not cut on the right').toBeLessThanOrEqual(1280);
  expect(box.y + box.height, 'not cut at the bottom').toBeLessThanOrEqual(720);
});

// J20 (C2, C3): duplicating a page neither opened the copy nor put the focus on its name. The copy opens, right after
// its source, with its name ready to type over.
test('J20: a duplicated page opens, right after its source, with its name ready to type', runs(OPEN, 'pages.duplicate#explorer-page-duplicate'), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, 'aurora');
  await openExplorer(page);
  await page.locator('[data-door="pages.duplicate#explorer-page-duplicate"]').first().click();
  await expect.poll(async () => (await port(page)).document.pages.length).toBe(2);
  const pages = (await port(page)).document.pages;
  expect(pages[1]?.name).not.toBe(pages[0]?.name);
  // its name field holds the focus, the name selected: what is typed next is its name
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.value ?? null)).toBe(pages[1]?.name);
  await page.keyboard.type('Contact');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await port(page)).document.pages[1]?.name).toBe('Contact');
});

// J21 (D2): component instances wore generic names with no badge. An instance's row names its component, in the accent.
test('J21: an instance’s Layers row names its component', runs(OPEN), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, 'catalog');
  await openExplorer(page);
  const badges = page.locator('[data-row-component]');
  await expect(badges.first()).toBeVisible();
  expect(await badges.evaluateAll((els) => els.map((el) => el.getAttribute('data-row-component')))).toContain('Plan');
});

// J22 (M4): an image without its source spanned the width its picture would not, and the layout jumped when the
// source came. It draws a neutral 16:9 marker of 640 × 360 at most, and the document holds no source.
test('J22: an image without a source draws a 16:9 marker no wider than 640 px', runs(INSERT_PANEL, TILE), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await runDoor(page, INSERT_PANEL);
  await runDoor(page, TILE, { args: { entry: 'image' } });
  const image = page.frameLocator('.frame__page').locator('img').first();
  await expect(image).toBeVisible();
  const size = await image.evaluate((el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
  expect(size.width).toBeLessThanOrEqual(640.5);
  expect(size.height / size.width).toBeCloseTo(9 / 16, 2);
  const tree = (await port(page)).document.pages[0]?.tree as Node;
  expect(tree.children[0]?.attributes.src, 'the document holds no source').toBeUndefined();
});

// J28 (M1–M4): "Seção colocado", "1 elementos": Portuguese messages agreed with names of unknown gender and counts
// did not agree. An insertion is said without agreeing with the name, and one element reads in the singular.
test('J28: Portuguese says an insertion without agreeing with its name, and one element in the singular', runs(INSERT_PANEL, TILE), async ({ browser }) => {
  const context = await browser.newContext({ locale: 'pt-BR' });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  // the empty page's root alone: one element, in the singular
  await expect(page.locator('.status-bar').getByText('1 elemento', { exact: true })).toHaveCount(1);
  await runDoor(page, INSERT_PANEL);
  await runDoor(page, TILE, { args: { entry: 'section' } });
  await expect(page.getByRole('status')).toHaveText('Inserção de Seção em Página, posição 1 de 1.');
  await expect(page.locator('.status-bar').getByText('2 elementos', { exact: true })).toHaveCount(1);
  await context.close();
});
