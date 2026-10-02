// A narrow window keeps the editor inside it (the code audit's U-010): at 1024 × 768 the window does not scroll
// sideways — the panels keep their widths and the canvas toolbar scrolls within itself — and every breakpoint tab
// stays reachable.
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runs } from './door.ts';

const PHONE = 'view.setBreakpoint#toolbar-breakpoint-tabs-phone';

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

// jornada03 J25: at 1280 × 720 with both side panels open the canvas keeps at least 55 % of the window, and the canvas
// toolbar fits whole (its buttons drawn as their icons, their names in their tooltips) instead of scrolling.
test('at 1280 × 720 the canvas keeps 55 % of the width and the canvas toolbar fits whole', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openEditor(page);
  const stage = await page.locator('.stage').evaluate((el) => el.getBoundingClientRect().width);
  expect(stage / 1280).toBeGreaterThanOrEqual(0.55);
  const toolbar = await page.locator('.canvas-toolbar').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(toolbar.scroll).toBeLessThanOrEqual(toolbar.client);
});
