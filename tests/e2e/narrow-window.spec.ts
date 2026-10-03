// A narrow window keeps the editor inside it (the code audit's U-010): at 1024 × 768 the window does not scroll
// sideways — the panels keep their widths and the canvas toolbar scrolls within itself — and every breakpoint tab
// stays reachable.
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';

const PHONE = 'view.setBreakpoint#toolbar-breakpoint-tabs-phone';
const INSERT = 'workspace.setPanelOpen#toolbar-activity-bar-insert';
const ESCAPE = 'focus.canvas#key-escape-in-palette';

test('at 1024 px the window does not scroll sideways, and the Phone tab is reachable', runs(PHONE), async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openEditor(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  const tab = control(page, PHONE);
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
});

// jornada03 J25 and H17: at 1280 × 720 the canvas has at least half of the window, measured as the study measured it,
// an area (the audit's AUD-06: this test measured 55 % of the width while the stage had 41 % of the window); and the
// canvas toolbar fits whole (its buttons drawn as their icons, their names in their tooltips) instead of scrolling.
// Below the narrow window's width the sidebar keeps no column: a first visit opens with it closed.
test('at 1280 × 720 the canvas has half of the window and the canvas toolbar fits whole', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openEditor(page);
  const stage = await page.locator('.stage').evaluate((el) => {
    const box = el.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  expect(stage.width / 1280).toBeGreaterThanOrEqual(0.55);
  expect((stage.width * stage.height) / (1280 * 720)).toBeGreaterThanOrEqual(0.5);
  const toolbar = await page.locator('.canvas-toolbar').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(toolbar.scroll).toBeLessThanOrEqual(toolbar.client);
});

// In the narrow window a panel of the activity bar opens over the canvas, which keeps its size; a press on the canvas
// closes it, and so does Escape, which takes the focus to the canvas.
test('in a narrow window the sidebar opens over the canvas and closes on a press outside it or on Escape', runs(INSERT, ESCAPE), async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openEditor(page);
  const stageWidth = () => page.locator('.stage').evaluate((el) => el.getBoundingClientRect().width);
  const before = await stageWidth();
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await runDoor(page, INSERT);
  await expect(page.locator('.sidebar')).toBeVisible();
  expect(await stageWidth()).toBe(before);
  const sidebar = await page.locator('.sidebar').evaluate((el) => getComputedStyle(el).position);
  expect(sidebar).toBe('fixed');
  // a press on the canvas, beside the open panel
  const stage = await page.locator('.stage').boundingBox();
  if (stage === null) throw new Error('no stage');
  await page.mouse.click(stage.x + stage.width - 40, stage.y + stage.height - 40);
  await expect(page.locator('.sidebar')).toHaveCount(0);
  // opened again, Escape in its palette takes the focus to the canvas and closes it
  await runDoor(page, INSERT);
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('.sidebar [data-door="element.insert#elements-tile"]').first().focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).toHaveCount(0);
});
