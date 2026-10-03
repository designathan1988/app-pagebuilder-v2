// The details where the editor differed from the canonical interface (design/final/index.html; the audit's AUD-28):
// Paste style in the context menu carries an icon, as Copy style does; the layout tool's item there says Layout, as the
// activity bar does; the quick panel's chip draws the canonical glyph (two sliders with round knobs: Lucide's
// settings-2); the command bar's Open Explorer draws the Explorer's own icon; and the bar's footer says the canonical
// words: ↑ ↓ choose, Enter run, Tab filter (Tab reaches the scope pills), Also and the bar's other chord.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, openCommandBar, openExplorer, openMenu, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const COPY_STYLE = 'clipboard.copyStyle#context-menu';
const PASTE_STYLE = 'clipboard.pasteStyle#context-menu';
const COMPOSE = 'layout.enter#layout-compose-menu';
const CHIP = 'quickPanel.setOpen#chip';
const OPEN_PANEL = 'workspace.setPanelOpen#command-bar-open-panel';

const menu = (page: Page) => page.locator('[role="menu"][data-region="context-menu"]');
// the icon a control draws: the sprite symbol its <use> names
const iconOf = (page: Page, selector: string) => page.locator(`${selector} svg use`).first().getAttribute('href');

async function openAurora(page: Page): Promise<void> {
  await openMenu(page, 'file');
  const chooser = page.waitForEvent('filechooser');
  await page.locator(`[data-door="${OPEN}"]`).click();
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-hero"]')).toHaveCount(1);
}

// the context menu of a node, opened with a right press on its row in the Layers
async function openContextMenu(page: Page, id: string): Promise<void> {
  await control(page, ROW, { args: { target: id } }).click({ button: 'right' });
  await expect(menu(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
});

test('the context menu says Layout as the activity bar does, and Paste style carries an icon as Copy style does', runs(OPEN, ROW, COPY_STYLE, PASTE_STYLE, COMPOSE), async ({ page }) => {
  await openAurora(page);
  await openExplorer(page);
  await openContextMenu(page, 'n-hero');
  await expect(menu(page).locator(`[data-door="${COMPOSE}"] .menu__label`)).toHaveText('Layout');
  await menu(page).locator(`[data-door="${COPY_STYLE}"]`).click();
  await openContextMenu(page, 'n-plans');
  expect(await iconOf(page, `[data-region="context-menu"] [data-door="${COPY_STYLE}"]`)).toBe('#palette');
  expect(await iconOf(page, `[data-region="context-menu"] [data-door="${PASTE_STYLE}"]`)).toBe('#brush');
});

test('the quick panel chip draws the canonical sliders glyph', runs(OPEN, ROW, CHIP), async ({ page }) => {
  await openAurora(page);
  await openExplorer(page);
  await control(page, ROW, { args: { target: 'n-hero' } }).click();
  expect(await iconOf(page, `[data-door="${CHIP}"]`)).toBe('#settings-2');
});

test('the command bar draws the Explorer\'s icon on Open Explorer, says the canonical footer, and Tab reaches the scope pills', runs(OPEN_PANEL), async ({ page }) => {
  await openCommandBar(page);
  const footer = page.locator('.command-bar__hints');
  expect((await footer.innerText()).replace(/\s+/gu, ' ').trim()).toBe('↑ ↓ choose Enter run Tab filter Also Ctrl+Shift+K');
  await page.keyboard.type('Explorer');
  expect(await iconOf(page, `[data-door="${OPEN_PANEL}"][data-args*='"panel":"explorer"']`)).toBe('#files');
  await page.keyboard.press('Tab');
  await expect(page.locator('.command-bar__scope').first()).toBeFocused();
});
