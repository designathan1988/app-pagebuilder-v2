import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runs } from './door.ts';

for (const [door, panel] of [['explorer', 'explorer'], ['insert', 'elements'], ['styles', 'variables']]) {
  const ref = `workspace.setPanelOpen#toolbar-activity-bar-${door}`;
  test(`the ${door} activity icon focuses its open panel without closing it`, runs(ref), async ({ page }) => {
    await openEditor(page);
    const icon = control(page, ref);
    await icon.click();
    const region = page.locator(`[data-panel-area="${panel}"]`).first();
    await expect(region).toBeVisible();
    await icon.click();
    await expect(region).toBeVisible();
    await expect(icon).toHaveAttribute('aria-pressed', 'true');
    await expect(icon).toHaveAttribute('title', /Collapse \(Ctrl\+B\)/);
    await expect.poll(() => region.evaluate(el => el.contains(document.activeElement))).toBe(true);
  });
}

test('opening a floating panel preserves its placement and its close button still works', runs('workspace.setPanelOpen#toolbar-activity-bar-insert', 'workspace.movePanel#panel-drag-panel-header-canvas'), async ({ page }) => {
  await openEditor(page);
  const icon = control(page, 'workspace.setPanelOpen#toolbar-activity-bar-insert');
  await icon.click();
  const grip = page.locator('[data-panel-header="elements"] [data-door="workspace.movePanel#panel-drag-panel-header-canvas"]');
  const box = await grip.boundingBox();
  if (!box) throw new Error('Insert has no panel grip');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(850, 350, { steps: 12 });
  await page.mouse.up();
  const floating = page.locator('[data-panel-window="elements"]');
  await expect(floating).toBeVisible();
  const before = await floating.boundingBox();
  await icon.click();
  await expect(floating).toBeVisible();
  expect(await floating.boundingBox()).toEqual(before);
  await expect.poll(() => floating.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await floating.locator('[data-door="workspace.setPanelOpen#panel-header-close"]').click();
  await expect(floating).toHaveCount(0);
  await icon.click();
  await page.keyboard.press('Control+b');
  await expect(page.locator('.sidebar')).toHaveCount(0);
});
