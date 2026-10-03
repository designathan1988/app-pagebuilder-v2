// Visual baselines (the plan's T.5): a picture of the editor in a few fixed states, compared with the one kept beside
// this file. A change that moves a pixel the design system draws — a token, a primitive, a region's layout — fails
// here until it is looked at and the picture taken again on purpose (npx playwright test visual --update-snapshots).
// Every state is still: no animation, no caret, the aurora fixture, one window size, the light and the dark theme; at
// most 50 pixels may differ (enough for a glyph's antialiasing, too few for a new icon).
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, openExplorer, runDoor, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const STILL = { animations: 'disabled', caret: 'hide', maxDiffPixels: 50 } as const;

async function aurora(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  // the theme chosen in the app (View › Theme): its default is dark (environment.json), so the browser's colour scheme
  // alone left the "light" pictures dark and the light theme with no baseline at all
  await runDoor(page, `preferences.setTheme#menu-theme-${scheme}`);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-title"]')).toHaveCount(1);
  await control(page, ROW, { args: { target: 'n-hero' } }).click();
  // the pointer rests where it hovers nothing
  await page.mouse.move(1, 899);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`the editor with a section selected, ${scheme}`, runs(OPEN, ROW), async ({ page }) => {
    await aurora(page, scheme);
    await expect(page).toHaveScreenshot(`editor-${scheme}.png`, STILL);
  });

  test(`the Style panel, ${scheme}`, runs(OPEN, ROW), async ({ page }) => {
    await aurora(page, scheme);
    await expect(page.locator('aside.inspector')).toHaveScreenshot(`inspector-style-${scheme}.png`, STILL);
  });

  test(`the Settings tab, ${scheme}`, runs(OPEN, ROW, 'workspace.setActiveTab#inspector-tab-settings'), async ({ page }) => {
    await aurora(page, scheme);
    await runDoor(page, 'workspace.setActiveTab#inspector-tab-settings');
    await page.mouse.move(1, 899);
    await expect(page.locator('aside.inspector')).toHaveScreenshot(`inspector-settings-${scheme}.png`, STILL);
  });

  test(`the quick panel, ${scheme}`, runs(OPEN, ROW), async ({ page }) => {
    await aurora(page, scheme);
    await page.locator('[data-quick-panel-chip]').click();
    await page.mouse.move(1, 899);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(page.locator('.quick-panel')).toHaveScreenshot(`quick-panel-${scheme}.png`, STILL);
  });

  test(`the command palette, ${scheme}`, runs(OPEN, ROW, 'commandBar.open#key-ctrl-k-in-global'), async ({ page }) => {
    await aurora(page, scheme);
    await runDoor(page, 'commandBar.open#key-ctrl-k-in-global');
    await page.keyboard.type('wrap');
    await expect(page.locator('[data-region="command-palette"]')).toHaveScreenshot(`palette-${scheme}.png`, STILL);
  });

  test(`the Arrange menu, ${scheme}`, runs(OPEN, ROW), async ({ page }) => {
    await aurora(page, scheme);
    await page.locator('[data-menu="arrange"]').click();
    await page.mouse.move(1, 899);
    await expect(page.locator('[data-region="menu:arrange"]')).toHaveScreenshot(`menu-arrange-${scheme}.png`, STILL);
  });

  test(`the Explorer and the Layers, ${scheme}`, runs(OPEN, ROW), async ({ page }) => {
    await aurora(page, scheme);
    // its subject: a fresh profile opens on Insert (the audit's AUD-21)
    await openExplorer(page);
    await expect(page.locator('aside.sidebar')).toHaveScreenshot(`sidebar-${scheme}.png`, STILL);
  });
}
