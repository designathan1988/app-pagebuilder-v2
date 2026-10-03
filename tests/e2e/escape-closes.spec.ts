// Escape closes what it opened, keeping nothing (the code audit's S-002, U-009, U-019, U-025): the + Class and Save as
// class popups — which also stay inside the window —, a Layers rename, a component's name prompt and a confirmation. The document is
// read through the read-only test port.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const STYLE = 'workspace.setActiveTab#inspector-tab-style';
const ADD_CLASS = 'classes.apply#inspector-class-add';
const SAVE_AS = 'classes.create#inspector-class-save-as';
const RENAME = 'layers.startRename#key-f2-in-layers-tree';
const EXPLORER = 'workspace.setPanelOpen#toolbar-activity-bar-explorer';
const ADD_PAGE = 'pages.add#explorer-add-page';
const DELETE_PAGE = 'pages.delete#explorer-page-delete';

const documentJson = (page: Page) => page.evaluate(() => JSON.stringify((window as unknown as { __builderTestPort: { document: () => unknown } }).__builderTestPort.document()));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-title"]')).toHaveCount(1);
  await control(page, ROW, { args: { target: 'n-title' } }).click();
});

test('the class popups open inside the window and close on Escape and on a press outside', runs(OPEN, ROW, STYLE, ADD_CLASS, SAVE_AS), async ({ page }) => {
  await runDoor(page, STYLE);
  for (const door of [ADD_CLASS, SAVE_AS]) {
    await control(page, door).click();
    const panel = page.locator('.class-popup__panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0), 'the popup ends inside the window').toBeLessThanOrEqual(1440);
    expect(await page.locator('aside.inspector').evaluate((el) => el.scrollLeft), 'the inspector is not scrolled sideways').toBe(0);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await control(page, door).click();
    await expect(panel).toBeVisible();
    await page.mouse.click(700, 450);
    await expect(panel).toHaveCount(0);
  }
});

test('Escape ends a Layers rename and keeps the name', runs(OPEN, ROW, RENAME), async ({ page }) => {
  const before = await documentJson(page);
  await control(page, ROW, { args: { target: 'n-title' } }).focus();
  await page.keyboard.press('F2');
  const field = page.locator('.row__rename .row__name-field');
  await expect(field).toBeFocused();
  await page.keyboard.type('Something else');
  await page.keyboard.press('Escape');
  await expect(field).toHaveCount(0);
  expect(await documentJson(page)).toBe(before);
});

// A confirmation is a modal dialog (docs/PRODUCT.md, The interface contract): the focus starts on Cancel and stays
// inside it, Escape answers Cancel and keeps everything, and the focus goes back to the control that asked.
test('Escape answers a confirmation with Cancel, and the focus stays inside it until then', runs(OPEN, ROW, EXPLORER, ADD_PAGE, DELETE_PAGE), async ({ page }) => {
  if (!(await control(page, ADD_PAGE).isVisible())) await runDoor(page, EXPLORER);
  await control(page, ADD_PAGE).click();
  const before = await documentJson(page);
  const remove = control(page, DELETE_PAGE).last();
  await remove.click();
  const dialog = page.locator('[role="alertdialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-confirmation="cancel"]')).toBeFocused();
  // Tab past the last answer comes back to the first; Shift+Tab before the first goes to the last
  await page.keyboard.press('Tab');
  await expect(dialog.locator('[data-confirmation="confirm"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('[data-confirmation="cancel"]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('[data-confirmation="confirm"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await documentJson(page), 'Escape deletes nothing').toBe(before);
  await expect(remove, 'the focus goes back to the control that asked').toBeFocused();
});
