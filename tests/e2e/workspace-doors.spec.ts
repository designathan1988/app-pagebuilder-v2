// Every door of the built workspace and preferences commands that the shell draws enabled, run through that door with
// the real mouse and keyboard (door.ts). Each test asserts an end artifact, the geometry of the window's regions, a
// computed style or the stored preferences after an immediate reload, so it fails when the door's command does
// nothing or does something else.
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { runDoor, runs } from './door.ts';

const box = async (page: Page, selector: string) => {
  const found = await page.locator(selector).boundingBox();
  if (found === null) throw new Error(`${selector} is not laid out`);
  return found;
};
const region = (page: Page, id: string) => box(page, `[data-region="${id}"]`);
const storedPreferences = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('preferences') ?? 'null') as unknown);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await expect(page.locator('.workbench')).toBeVisible();
});

for (const ref of ['workspace.setPanelOpen#menu-view-elements']) {
  test(`${ref} puts Insert in the sidebar, and a second time gives the sidebar's column to the canvas`, runs(ref), async ({ page }) => {
    const start = await box(page, '.workbench');
    const sidebar = await box(page, '.sidebar');
    await runDoor(page, ref);
    const insert = await region(page, 'insert');
    expect(insert.x).toBeCloseTo(sidebar.x, 0);
    expect(insert.width).toBeGreaterThan(sidebar.width / 2);
    // the Explorer's own body goes with the view switched, while the Layers stays: it shows in the stack below
    // whatever view shows (the user's real-use audit, item 3.9; spec panel-resize)
    await expect(page.locator('[data-region="explorer-pages"]')).toHaveCount(0);
    await expect(page.locator('[data-region="explorer-layers"]')).toHaveCount(1);

    await runDoor(page, ref);
    await expect(page.locator('.sidebar')).toHaveCount(0);
    const wider = await box(page, '.workbench');
    expect(wider.x).toBeCloseTo(sidebar.x, 0);
    expect(wider.width).toBeCloseTo(start.width + sidebar.width, 0);
  });
}

// The activity bar's icons open their view and give it the focus; pressed again they keep it open (the user's
// real-use audit, J8, QA-LOG 40: pressing the active icon used to hide its panel). View › Insert and View › Explorer
// still turn their view on and off, below.
for (const [ref, view] of [['workspace.setPanelOpen#toolbar-activity-bar-insert', 'insert'], ['workspace.setPanelOpen#toolbar-activity-bar-explorer', 'explorer-pages']] as const) {
  test(`${ref} opens its view in the sidebar, and a second time keeps it open`, runs(ref), async ({ page }) => {
    const sidebar = await box(page, '.sidebar');
    await runDoor(page, ref);
    const shown = await region(page, view);
    expect(shown.x).toBeCloseTo(sidebar.x, 0);
    await runDoor(page, ref);
    await expect(page.locator(`[data-region="${view}"]`)).toHaveCount(1);
    expect(await box(page, '.sidebar')).toEqual(sidebar);
    expect((await region(page, view)).x).toBeCloseTo(sidebar.x, 0);
  });
}

// View › Explorer and the activity bar's Explorer do the same (the audit's A3.23: View › Explorer belongs to the feature
// that built the Explorer, layers-tree, and is no longer drawn not available yet)
for (const ref of ['workspace.setPanelOpen#menu-view-explorer']) {
  test(`${ref} gives the Explorer's column to the canvas, and a second time puts the Explorer back`, runs(ref), async ({ page }) => {
    const start = await box(page, '.workbench');
    const sidebar = await box(page, '.sidebar');
    const layers = await region(page, 'explorer-layers');
    await runDoor(page, ref);
    await expect(page.locator('.sidebar')).toHaveCount(0);
    const wider = await box(page, '.workbench');
    expect(wider.x).toBeCloseTo(sidebar.x, 0);
    expect(wider.width).toBeCloseTo(start.width + sidebar.width, 0);

    await runDoor(page, ref);
    expect(await box(page, '.workbench')).toEqual(start);
    expect(await region(page, 'explorer-layers')).toEqual(layers);
  });
}

for (const ref of ['workspace.setPanelOpen#menu-view-layers', 'workspace.setPanelOpen#toolbar-layers-header-toggle']) {
  test(`${ref} folds the Layers section to its title, and a second time unfolds it`, runs(ref), async ({ page }) => {
    const open = await region(page, 'explorer-layers');
    await runDoor(page, ref);
    await expect(page.locator('[data-region="layers-row"]')).toHaveCount(0);
    // folded, the section keeps its title alone and hands its room back (spec panel-resize: the stack is the size the
    // splitter holds, and a folded section is only its header)
    const folded = await region(page, 'explorer-layers');
    expect(folded.height).toBeGreaterThan(16);
    expect(folded.height).toBeLessThan(open.height / 2);

    await runDoor(page, ref);
    expect(await region(page, 'explorer-layers')).toEqual(open);
  });
}

test('View › Inspector gives the inspector column to the canvas, and a second time takes it back', runs('workspace.setPanelOpen#menu-view-inspector'), async ({ page }) => {
  const start = await box(page, '.workbench');
  const inspector = await box(page, '.inspector');
  await runDoor(page, 'workspace.setPanelOpen#menu-view-inspector');
  await expect(page.locator('.inspector')).toHaveCount(0);
  expect((await box(page, '.workbench')).width).toBeCloseTo(start.width + inspector.width, 0);

  await runDoor(page, 'workspace.setPanelOpen#menu-view-inspector');
  expect(await box(page, '.workbench')).toEqual(start);
  expect(await box(page, '.inspector')).toEqual(inspector);
});

// the right edge of the controls the canvas toolbar draws from its left (the zoom menu keeps to the right end)
const toolbarEnd = (page: Page) =>
  page
    .locator('[data-region="canvas-toolbar"]')
    .evaluate((el) => Math.max(...[...el.querySelectorAll('button')].filter((b) => b.closest('.canvas-toolbar__zoom') === null && b.closest('.frame-tabs') === null).map((b) => b.getBoundingClientRect().right)));

for (const ref of ['workspace.setPanelOpen#menu-view-canvas-tools', 'workspace.setPanelOpen#toolbar-canvas-toolbar-canvas-tools']) {
  test(`${ref} takes the canvas tools out of the canvas toolbar, and a second time puts them back`, runs(ref), async ({ page }) => {
    const open = await toolbarEnd(page);
    await runDoor(page, ref);
    const closed = await toolbarEnd(page);
    expect(closed).toBeLessThan(open - 20);

    await runDoor(page, ref);
    expect(await toolbarEnd(page)).toBe(open);
  });
}

test('the dock strip closes the tab it shows and shows the next one; closing the last tab hides the workbench', runs('workspace.setWorkbenchState#toolbar-workbench-strip-toggle', 'workspace.setPanelOpen#workbench-tab-close'), async ({ page }) => {
  const tabs = () => page.locator('[data-region="tab-strip"] [role="tab"]').evaluateAll((els) => els.map((el) => el.textContent));
  const shown = () => page.locator('.dock [role="tabpanel"]').getAttribute('aria-label');
  // with no tab left, a shown and a hidden workbench take the same room; the show/hide toggle says which it is
  const toggle = page.locator('[data-door="workspace.setWorkbenchState#toolbar-workbench-strip-toggle"]');
  const canvas = await box(page, '.centre');
  // the dock closed (the fresh profile) draws no strip: View › Workbench opens it
  await runDoor(page, 'workspace.setPanelOpen#menu-view-workbench');
  expect(await tabs()).toEqual(['Timeline', 'Checks']);
  expect(await shown()).toBe('Timeline');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const two = await region(page, 'tab-strip');

  await runDoor(page, 'workspace.setPanelOpen#workbench-tab-close');
  expect(await tabs()).toEqual(['Checks']);
  expect(await shown()).toBe('Checks');
  expect((await region(page, 'tab-strip')).width).toBeLessThan(two.width - 20);

  await runDoor(page, 'workspace.setPanelOpen#workbench-tab-close');
  expect(await tabs()).toEqual([]);
  await expect(page.locator('.dock [role="tabpanel"]')).toHaveCount(0);
  expect(await box(page, '.centre')).toEqual(canvas);
  // folded, the dock draws no strip at all (the audit's A3.18)
  await expect(toggle).toHaveCount(0);
});

test('the dock strip folds the workbench away and View › Workbench shows it again', runs('workspace.setWorkbenchState#toolbar-workbench-strip-toggle'), async ({ page }) => {
  const canvas = await box(page, '.centre');
  await runDoor(page, 'workspace.setPanelOpen#menu-view-workbench');
  const strip = await region(page, 'dock-strip');
  const shorter = await box(page, '.centre');
  expect(shorter.height).toBeLessThan(canvas.height - 50);
  expect((await box(page, '.dock')).y).toBeGreaterThanOrEqual(shorter.y + shorter.height - 1);

  await runDoor(page, 'workspace.setWorkbenchState#toolbar-workbench-strip-toggle');
  expect(await box(page, '.centre')).toEqual(canvas);
  // folded, the strip is gone whole
  await expect(page.locator('[data-region="dock-strip"]')).toHaveCount(0);
  await runDoor(page, 'workspace.setPanelOpen#menu-view-workbench');
  expect(await region(page, 'dock-strip')).toEqual(strip);
});

test('the dock strip maximises the workbench over the canvas, and a second time restores it under the canvas', runs('workspace.setWorkbenchState#toolbar-workbench-strip-maximize'), async ({ page }) => {
  const canvas = await box(page, '.centre');
  await runDoor(page, 'workspace.setPanelOpen#menu-view-workbench');
  await runDoor(page, 'workspace.setWorkbenchState#toolbar-workbench-strip-maximize');
  const dock = await box(page, '.dock');
  expect(dock.y).toBeLessThanOrEqual(canvas.y + 1);
  expect(dock.height).toBeGreaterThan(canvas.height - 1);

  await runDoor(page, 'workspace.setWorkbenchState#toolbar-workbench-strip-maximize');
  const restored = await box(page, '.centre');
  expect(restored.y).toBeCloseTo(canvas.y, 0);
  expect(restored.height).toBeLessThan(canvas.height - 50);
  expect((await box(page, '.dock')).y).toBeGreaterThanOrEqual(restored.y + restored.height - 1);
});

test('View › Toggle sidebar gives the sidebar column to the canvas, and a second time takes it back', runs('workspace.toggleLeftDock#menu-view'), async ({ page }) => {
  const start = await box(page, '.workbench');
  const sidebar = await box(page, '.sidebar');
  await runDoor(page, 'workspace.toggleLeftDock#menu-view');
  await expect(page.locator('.sidebar')).toHaveCount(0);
  expect((await box(page, '.workbench')).width).toBeCloseTo(start.width + sidebar.width, 0);

  await runDoor(page, 'workspace.toggleLeftDock#menu-view');
  expect(await box(page, '.workbench')).toEqual(start);
});

test('View › Collapse docks gives every column to the canvas, and a second time puts back what was open', runs('workspace.collapseDocks#menu-view'), async ({ page }) => {
  const start = await box(page, '.workbench');
  const sidebar = await box(page, '.sidebar');
  const inspector = await box(page, '.inspector');
  await runDoor(page, 'workspace.collapseDocks#menu-view');
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(page.locator('.inspector')).toHaveCount(0);
  expect((await box(page, '.workbench')).width).toBeCloseTo(start.width + sidebar.width + inspector.width, 0);

  await runDoor(page, 'workspace.collapseDocks#menu-view');
  expect(await box(page, '.workbench')).toEqual(start);
});

test('Language › English brings the editor back from Portuguese and keeps it after reload', runs('preferences.setLanguage#menu-language-pt-br', 'preferences.setLanguage#menu-language-en'), async ({ page }) => {
  const view = page.locator('.menu-button[data-menu="view"]');
  await expect(view).toHaveText('View');
  await runDoor(page, 'preferences.setLanguage#menu-language-pt-br');
  await expect(view).toHaveText('Exibir');
  await runDoor(page, 'preferences.setLanguage#menu-language-en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(view).toHaveText('View');

  await page.reload();
  expect(await storedPreferences(page)).toEqual({ locale: 'en', theme: 'dark' });
  await expect(view).toHaveText('View');
});

test('View › Theme › Dark brings the dark theme back from Light and keeps it after reload', runs('preferences.setTheme#menu-theme-light', 'preferences.setTheme#menu-theme-dark'), async ({ page }) => {
  const background = () => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
  const dark = await background();
  await runDoor(page, 'preferences.setTheme#menu-theme-light');
  expect(await background()).not.toBe(dark);
  await runDoor(page, 'preferences.setTheme#menu-theme-dark');
  expect(await background()).toBe(dark);

  await page.reload();
  expect(await storedPreferences(page)).toEqual({ locale: 'en', theme: 'dark' });
  expect(await background()).toBe(dark);
});
