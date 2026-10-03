// absolute-anchors beyond its scenarios (spec/BEHAVIOUR.md#absolute-anchors, Problems in Pager 3): the anchor tabs are
// never covered by other canvas chrome. A narrow positioned element's top tab, just above the middle of its top edge,
// would meet the selection's label, which sits above the element from its left edge: the tab moves past it. The
// scenarios cannot say where chrome is drawn: this test reads the boxes in Chrome.
import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const WIDTH = 'style.set#inspector-width';
const POSITION = 'position.setMode#inspector-position';
const TOP_TAB = 'position.setAnchors#handle-anchor-top';

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('not laid out');
  return box;
};
const meet = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('the top anchor tab of a narrow element is not covered by its label nor the quick panel chip', runs(OPEN, ROW, WIDTH, POSITION, TOP_TAB), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await control(page, ROW, { args: { target: 'n-intro' } }).click();
  const width = control(page, WIDTH).locator('input').first();
  await width.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('40\n');
  await runDoor(page, POSITION, { args: { mode: 'absolute' } });
  const tab = page.locator(`[data-door="${TOP_TAB}"]`);
  await expect(tab).toBeVisible();
  const label = page.locator('[data-chrome="label"][data-label-for="n-intro"]');
  await expect(label).toBeVisible();
  // the label, wider than half the element, would reach the middle of its top edge
  const intro = await page.frameLocator('.frame__page').locator('[data-node="n-intro"]').evaluate((el) => el.getBoundingClientRect().width);
  expect(intro).toBeLessThan(60);
  const tabBox = await boxOf(tab);
  expect(meet(tabBox, await boxOf(label)), 'the top tab meets the label').toBe(false);
  const chip = page.locator('.quick-panel-chip');
  if ((await chip.count()) > 0) expect(meet(tabBox, await boxOf(chip)), 'the top tab meets the quick panel chip').toBe(false);
});

// Each tab is a toggle that says whether its edge is anchored (spec absolute-anchors; the audit's U-051): an element
// that holds no inset reads anchored at its start edges, and a press turns the tab over.
test('an anchor tab says whether its edge is anchored, and a press turns it over', runs(OPEN, ROW, POSITION, 'position.setAnchors#handle-anchor-right'), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await control(page, ROW, { args: { target: 'n-intro' } }).click();
  await runDoor(page, POSITION, { args: { mode: 'absolute' } });
  const left = page.locator('[data-door="position.setAnchors#handle-anchor-left"]');
  const right = page.locator('[data-door="position.setAnchors#handle-anchor-right"]');
  await expect(left).toHaveAttribute('aria-pressed', 'true');
  await expect(right).toHaveAttribute('aria-pressed', 'false');
  // Intro's box in the page's own CSS px
  const intro = () => page.frameLocator('.frame__page').locator('[data-node="n-intro"]').evaluate((el) => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number });
  const before = await intro();
  await right.click();
  await expect(right).toHaveAttribute('aria-pressed', 'true');
  // what the press wrote (the audit's AUD-35: the tab's state alone): both horizontal insets, measured where the
  // element lies, in whole px, so it does not move but by the rounding of its start edge and never narrows (its one
  // line of text stays one line)
  await expect.poll(() => introBase(page).then((base) => [base.left !== undefined, base.right !== undefined])).toEqual([true, true]);
  const after = await intro();
  expect(after.height, 'the text keeps its lines').toBeCloseTo(before.height, 1);
  expect(Math.abs(after.x - before.x), 'the start edge moves by its rounding at most').toBeLessThanOrEqual(0.5);
  expect(after.width, 'never narrower than drawn').toBeGreaterThanOrEqual(before.width - 0.01);
  expect(after.width, 'wider by less than a px').toBeLessThan(before.width + 1);
});

// the declarations Intro holds at the base layer, read from the document
type Base = Readonly<Record<string, string | undefined>>;
const introBase = (page: Page) =>
  page.evaluate(() => {
    type Node = { id: string; styles: { desktop?: { base?: Base } }; children: Node[] };
    const tree = (window as unknown as { __builderTestPort: { document(): { pages: { tree: Node }[] } } }).__builderTestPort.document().pages[0]?.tree;
    const find = (node: Node | undefined): Node | undefined => node === undefined || node.id === 'n-intro' ? node : node.children.map(find).find((found) => found !== undefined);
    return find(tree)?.styles.desktop?.base ?? {};
  });
