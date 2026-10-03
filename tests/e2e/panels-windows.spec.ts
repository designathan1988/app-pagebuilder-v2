// The panels that leave their place (specs floating-panels, panel-combine-tabs, workspace-persist-reset), driven with
// the real mouse: a panel's header dragged out floats a window at the drop point, kept inside the window; the edge
// hints dock it left or right; over another panel's upper part the hint combines them as tabs and over the lower part
// stacks them; Escape lets the drag go without a word; the arrangement survives a reload; Reset workspace puts the
// defaults back and says so. The end artifacts are the DOM the person sees, what the editor stored (localStorage) and
// the document the read-only test port reads — never a bare "it exists".
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { runDoor, runs, openExplorer } from './door.ts';

const CANVAS = 'workspace.movePanel#panel-drag-panel-header-canvas';
const LEFT = 'workspace.movePanel#panel-drag-panel-header-left-edge';
const RIGHT = 'workspace.movePanel#panel-drag-panel-header-right-edge';
const UPPER = 'workspace.movePanel#panel-drag-panel-header-panel-upper-part';
const LOWER = 'workspace.movePanel#panel-drag-panel-header-panel-lower-part';
const ANYWHERE = 'workspace.movePanel#panel-drag-floating-header-anywhere';
const TAB = 'workspace.setActiveTab#sidebar-tab';
const RESET = 'workspace.reset#menu-view';

const band = (page: Page, ref: string, panel: string) => page.locator(`[data-door="${ref}"][data-args*='"panel":"${panel}"']`).first();
const centre = async (locator: ReturnType<typeof band>) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('the control is not laid out');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
// a person's drag: press on the header's grip, move past the threshold, move to the place, and (unless told not to)
// release there
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  if (release) await page.mouse.up();
  await page.waitForTimeout(150);
}
const hint = (page: Page) => page.locator('[data-region="panel-hint"] .panel-hint__label').innerText();
const floating = (page: Page) => page.locator('[data-panel-window]');
const stored = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('workspace') ?? 'null') as { layout?: Record<string, unknown> } | null);
const document0 = (page: Page) => page.evaluate(() => JSON.stringify((window as unknown as { __builderTestPort: { document: () => unknown } }).__builderTestPort.document()));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
});

test('a header dragged onto the canvas floats a window at the drop point, kept inside the window', runs(CANVAS, ANYWHERE), async ({ page }) => {
  const start = await centre(band(page, CANVAS, 'layers'));
  await drag(page, start, { x: 900, y: 400 });
  const window = floating(page);
  await expect(window).toHaveCount(1);
  const box = await window.boundingBox();
  // the window opens at the drop point (its own corner at the pointer), its width the token's
  expect(Math.round(box?.x ?? 0)).toBe(900);
  expect(Math.round(box?.y ?? 0)).toBe(400);
  expect(Math.round(box?.width ?? 0)).toBe(240);
  // the Layers section is no longer drawn by the sidebar, and the window draws its body
  await expect(page.locator('.sidebar [data-panel-header="layers"]')).toHaveCount(0);
  await expect(window.locator('[data-region="layers-row"]')).toHaveCount(1);
  // dragged again by its own header near the bottom-right corner it is kept inside the window
  const again = await centre(band(page, ANYWHERE, 'layers'));
  await drag(page, again, { x: 1200, y: 700 });
  const kept = await window.boundingBox();
  expect(Math.round(kept?.x ?? -1)).toBe(1200);
  // the drop point is past the window's room below: the window is kept inside, never above the top bar
  expect((kept?.y ?? 0) + (kept?.height ?? 0)).toBeLessThanOrEqual(900);
  expect(kept?.y ?? 0).toBeGreaterThanOrEqual(44);
  // and the arrangement is what the editor stored for the next session
  const saved = await stored(page);
  expect(saved?.layout?.floating).toMatchObject([{ panel: 'layers' }]);
});

test('the hints name the place, and Escape lets the drag go without a word', runs(LEFT, RIGHT, UPPER, LOWER), async ({ page }) => {
  const before = await document0(page);
  const start = await centre(band(page, LEFT, 'layers'));
  // near the left edge: Dock left
  await drag(page, start, { x: 40, y: start.y }, false);
  await expect.poll(() => hint(page)).toBe('Dock left');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(150);
  await expect(page.locator('[data-region="panel-hint"]')).toHaveCount(0);
  await expect(floating(page)).toHaveCount(0);
  expect(await document0(page)).toBe(before);
  // near the right edge: Dock right, and the release docks it there
  await drag(page, start, { x: 1435, y: start.y });
  await expect(page.locator('[data-region="right-dock"] [data-panel-header="layers"]')).toHaveCount(1);
  await expect(page.locator('.sidebar [data-panel-header="layers"]')).toHaveCount(0);
  // and it is where the editor stored it, after an immediate reload
  await page.reload();
  await expect(page.locator('.workbench')).toBeVisible();
  await expect(page.locator('[data-region="right-dock"] [data-panel-header="layers"]')).toHaveCount(1);
});

test('a drag over another panel combines as tabs on its upper part and stacks on its lower part', runs(UPPER, LOWER, TAB), async ({ page }) => {
  // the Explorer floats, so the sidebar shows the Insert view and the Layers section: two panels to drop on
  await openExplorer(page);
  await drag(page, await centre(band(page, CANVAS, 'explorer')), { x: 176, y: 56 });
  await expect(floating(page)).toHaveCount(1);
  const view = await page.locator('.sidebar__view').boundingBox();
  if (view === null) throw new Error('the sidebar view is not laid out');
  // the upper part of the Insert view: Combine as tabs
  const anywhere = await centre(band(page, ANYWHERE, 'explorer'));
  await drag(page, anywhere, { x: view.x + view.width / 2, y: view.y + 30 }, false);
  await expect.poll(() => hint(page)).toBe('Combine as tabs');
  await page.mouse.up();
  await page.waitForTimeout(150);
  // both panels are tabs of one area, and the tab strip switches the body between them
  const tabs = page.locator('.panel-area__tabs [data-door="workspace.setActiveTab#sidebar-tab"]');
  await expect(tabs).toHaveCount(2);
  await expect(page.locator('.sidebar [data-region="insert"]')).toHaveCount(1);
  await tabs.filter({ hasText: 'Explorer' }).click();
  await expect(page.locator('.sidebar [data-region="explorer-pages"]')).toHaveCount(1);
  await expect(page.locator('.sidebar [data-region="insert"]')).toHaveCount(0);
  // the lower part of the Layers section: Stack panels, and its body goes under the panel it lands on
  const layers = await page.locator('.panel-area[data-panel-area="layers"]').first().boundingBox();
  if (layers === null) throw new Error('the layers area is not laid out');
  const explorerTab = await centre(band(page, LOWER, 'explorer'));
  await drag(page, explorerTab, { x: layers.x + layers.width / 2, y: layers.y + layers.height * 0.9 }, false);
  await expect.poll(() => hint(page)).toBe('Stack panels');
  await page.mouse.up();
  await page.waitForTimeout(150);
  await expect(page.locator('.sidebar .panel-area--stacked .panel-area__body[aria-label="Explorer"]')).toHaveCount(1);
});

test('Reset workspace puts the default docks, sizes and panels back, and the document is untouched', runs(RESET), async ({ page }) => {
  const document0Text = await document0(page);
  await drag(page, await centre(band(page, CANVAS, 'layers')), { x: 900, y: 400 });
  await expect(floating(page)).toHaveCount(1);
  await runDoor(page, 'workspace.toggleInspector#key-ctrl-alt-b-in-global');
  await expect(page.locator('.inspector')).toHaveCount(0);
  await runDoor(page, RESET);
  await expect(page.getByRole('status')).toHaveText('Workspace reset: the default docks, sizes and panels.');
  await expect(page.locator('.inspector')).toHaveCount(1);
  await expect(floating(page)).toHaveCount(0);
  await expect(page.locator('.sidebar [data-panel-header="layers"]')).toHaveCount(1);
  expect(await document0(page)).toBe(document0Text);
  // the reset is what the editor stored: an immediate reload keeps the default workspace
  await page.reload();
  await expect(page.locator('.workbench')).toBeVisible();
  await expect(floating(page)).toHaveCount(0);
  await expect(page.locator('.sidebar [data-panel-header="layers"]')).toHaveCount(1);
});
