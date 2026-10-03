// drag-autoscroll beyond its scenario (spec/BEHAVIOUR.md#drag-autoscroll, Problems in Pager 2): the Layers tree scrolls
// the way the page does while a drag rests near its edge, so a row below its fold is reached by dragging — its own
// box, its own scroll. The scenarios cannot say how far a panel scrolls, which its height decides: this test reads the
// tree's own scroll in Chrome, on a window short enough for the aurora tree to overflow it.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, openExplorer, runDoor, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const DRAG = 'element.moveTo#layers-drag-layers-row-row-zones';

const documentNow = (page: Page) => page.evaluate(() => JSON.stringify((window as unknown as { __builderTestPort: { document: () => unknown } }).__builderTestPort.document()));
const treeScroll = (page: Page) => page.locator('.layers-tree').evaluate((el) => ({ top: el.scrollTop, height: el.scrollHeight, view: el.clientHeight }));

test('a row dragged to the bottom edge of the Layers tree scrolls the tree to the rows below its fold', runs(OPEN, ROW, DRAG), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await openExplorer(page);
  await expect(control(page, ROW, { args: { target: 'n-title' } }).first()).toBeVisible();
  const start = await treeScroll(page);
  expect(start.height, 'the tree overflows its panel').toBeGreaterThan(start.view + 40);
  expect(start.top).toBe(0);
  const before = await documentNow(page);

  // the Title's row pressed, carried to the middle of the tree (inside it, beyond the zone: the scroll is armed), then
  // to just above the tree's bottom edge, where it rests
  const tree = await page.locator('.layers-tree').boundingBox();
  const row = await control(page, ROW, { args: { target: 'n-title' } }).first().boundingBox();
  if (tree === null || row === null) throw new Error('the Layers tree is not laid out');
  const x = row.x + row.width / 2;
  await page.mouse.move(x, row.y + row.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, tree.y + tree.height / 2, { steps: 8 });
  await page.mouse.move(x, tree.y + tree.height - 6, { steps: 8 });
  // resting there, the tree scrolls to its end: the last rows, below the fold before, are under the drag
  await expect.poll(async () => (await treeScroll(page)).top, { message: 'the tree scrolls to its end while the drag rests at its bottom edge', timeout: 4000 }).toBeGreaterThanOrEqual(start.height - start.view - 1);

  // Escape takes the drag back: nothing moved
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await documentNow(page)).toBe(before);
});
