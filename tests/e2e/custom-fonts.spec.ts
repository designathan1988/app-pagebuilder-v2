// custom-fonts beyond its scenarios (spec/BEHAVIOUR.md#custom-fonts): the project's fonts lead the font menu's first
// list, each drawn in its own face, without More values and in Essentials only too (the audit's AUD-12: an uploaded
// font showed only in the longer list, behind 12 system stacks).
import fs from 'node:fs';
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { WOFF2_TEST } from '../../tools/runner/scenarios.ts';
import { openMenu, runDoor, runs, setSectionOpen } from './door.ts';

const OPEN = 'project.open#menu-file';
const EXPLORER = 'workspace.setPanelOpen#toolbar-activity-bar-explorer';
const UPLOAD = 'files.upload#explorer-upload';
const ROW = 'selection.select#layers-row';
const ESSENTIALS = 'inspector.setMode#inspector-mode-essentials';
const ALL = 'inspector.setMode#inspector-mode-all';
const FAMILY = 'style.set#inspector-font-family';

test('the project’s fonts lead the font menu, in Essentials only and in All properties', runs(OPEN, EXPLORER, UPLOAD, ROW, ESSENTIALS, ALL, FAMILY), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await openMenu(page, 'file');
  const opened = page.waitForEvent('filechooser');
  await page.locator(`[data-door="${OPEN}"]`).click();
  await (await opened).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync('manifest/features/fixtures/aurora.json') });
  await runDoor(page, EXPLORER);
  const chosen = page.waitForEvent('filechooser');
  await runDoor(page, UPLOAD);
  await (await chosen).setFiles({ name: 'Grao Display.woff2', mimeType: 'font/woff2', buffer: WOFF2_TEST });
  await expect(page.locator('.row__name', { hasText: 'Grao Display.woff2' })).toBeVisible();
  await runDoor(page, ROW, { args: { target: 'n-card-a-title' } });
  for (const mode of [ESSENTIALS, ALL]) {
    await runDoor(page, mode);
    await setSectionOpen(page, 'text', true);
    const family = page.locator(`[data-door="${FAMILY}"]`).first();
    await family.scrollIntoViewIfNeeded();
    await family.locator('.field__values-button').click();
    const menu = page.locator('.field__menu[role="menu"]').last();
    await expect(menu).toBeVisible();
    const items = menu.locator('[role="menuitemradio"]');
    await expect(items.first(), `${mode}: the project's font first`).toHaveText('Grao Display');
    // drawn in its own face
    expect(await items.first().locator('.menu__label').evaluate((label) => getComputedStyle(label).fontFamily)).toContain('Grao Display');
    await page.keyboard.press('Escape');
  }
});
