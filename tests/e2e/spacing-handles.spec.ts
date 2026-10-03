// spacing-handles beyond its scenarios (spec/BEHAVIOUR.md#spacing-handles): in Padding mode the four sides are drawn as
// tinted bands labelled with their values (Problems in Pager 1), as thick on the screen as the padding times the zoom;
// Margin mode draws the margin's bands in another colour; Escape on the canvas leaves the mode (the selection stays)
// and the bands go. The scenarios cannot say what the canvas draws: this test reads the bands in Chrome.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const MODE = 'canvas.setEditMode#quick-panel-edit-on-canvas';
const ESCAPE = 'canvas.setEditMode#key-escape-in-canvas-edit-mode';
const TOP = 'style.setSpacing#handle-padding-top-band';

const bands = (page: Page) => page.locator('[data-canvas-overlay] [data-edit-handle]');
// the quick panel's Edit on canvas menu opened (its button: no door of its own) and a mode chosen
async function chooseMode(page: Page, mode: string): Promise<void> {
  if ((await page.locator('[data-quick-panel-chip][aria-expanded="false"]').count()) > 0) await page.locator('[data-quick-panel-chip]').click();
  await page.locator(`[data-door="${MODE}"][aria-haspopup]`).click();
  await control(page, MODE, { args: { mode } }).click();
}

test('padding and margin bands are drawn with their values; the mode pins them and Escape lets them go', runs(OPEN, ROW, MODE, ESCAPE), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await control(page, ROW, { args: { target: 'n-hero' } }).click();
  // item 4.1: the spacing bands are drawn on any selection, faint until the pointer is on them, and their mode pins
  // them; the gap draws none in a block container (A3.15)
  await expect(bands(page), 'the spacing bands are drawn, waiting').toHaveCount(8);
  await expect(page.locator('[data-canvas-overlay] .chrome__band--auto'), 'none is pinned yet').toHaveCount(8);
  await chooseMode(page, 'padding');
  await expect(page.locator('[data-canvas-overlay] .chrome__band--padding:not(.chrome__band--auto)'), 'the padding mode pins its four').toHaveCount(4);
  // Hero's padding: 56px top, 40px sides; its top band as tall as 56 CSS px on the screen, tinted, labelled 56
  const top = page.locator(`[data-canvas-overlay] [data-door="${TOP}"]`);
  await expect(top).toHaveText('56');
  const zoom = await page.evaluate(() => document.querySelector<HTMLIFrameElement>('.frame__page')?.currentCSSZoom ?? 1);
  const height = (await top.boundingBox())?.height ?? 0;
  expect(Math.abs(height - 56 * zoom)).toBeLessThan(1);
  const tint = (locator: typeof top) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);
  const padding = await tint(top);
  expect(padding).not.toBe('rgba(0, 0, 0, 0)');
  // Margin mode: other bands, in another colour
  await chooseMode(page, 'margin');
  await expect(page.locator('[data-canvas-overlay] .chrome__band--margin:not(.chrome__band--auto)'), 'the margin mode pins its own').toHaveCount(4);
  await expect(page.locator('[data-canvas-overlay] [data-door="style.setSpacing#handle-margin-top-band"]')).toHaveCount(1);
  expect(await tint(page.locator('[data-canvas-overlay] [data-door="style.setSpacing#handle-margin-top-band"]'))).not.toBe(padding);
  // Hero's margin is 0: its bands are drawn thinner than a number (spacing.valueMinBand), which shows only under the
  // pointer (spec spacing-handles, Problems in Pager 6; the audit's U-036), while the padding's 56 always shows
  const marginBottom = page.locator('[data-canvas-overlay] [data-door="style.setSpacing#handle-margin-bottom-band"]');
  await expect(marginBottom).toHaveClass(/chrome__band--thin/);
  await expect(marginBottom.locator('.chrome__handle-value')).toBeHidden();
  await expect(top.locator('.chrome__handle-value')).toBeVisible();
  await marginBottom.hover();
  await expect(marginBottom.locator('.chrome__handle-value')).toBeVisible();
  await page.mouse.move(5, 5);
  // Escape on the canvas leaves the mode, and only the mode: the selection stays (the canvas's own Escape waits)
  // choosing the mode folded the quick panel to its chip: its handles are never under it (spec quick-panel, Problems
  // in Pager 10)
  await expect(page.locator('[data-quick-panel-chip]')).toHaveAttribute('aria-expanded', 'false');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await runDoor(page, ESCAPE);
  await expect(bands(page), 'the bands stay, unpinned').toHaveCount(8);
  await expect(page.locator('[data-canvas-overlay] .chrome__band--auto')).toHaveCount(8);
  expect(await page.evaluate(() => (window as unknown as { __builderTestPort: { selection: () => string[] } }).__builderTestPort.selection())).toEqual(['n-hero']);
});

// the display field of the inspector's Layout section
const DISPLAY = 'style.set#inspector-display';
async function setDisplay(page: Page, value: string): Promise<void> {
  await control(page, DISPLAY).locator('input').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}
// the editor with the fixture open, its page settled
async function openAurora(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-grid"]')).toHaveCount(1);
}

// A3.15: the gap mode is offered only where a gap exists to edit (a flex or grid container). On a section, which lays
// out in block, its item is disabled and says so; the padding's own item stays offered.
test('the Edit on canvas menu disables the gap, with its reason, on a container that is not flex or grid', runs(OPEN, ROW, MODE), async ({ page }) => {
  await openAurora(page);
  await control(page, ROW, { args: { target: 'n-hero' } }).click();
  if ((await page.locator('[data-quick-panel-chip][aria-expanded="false"]').count()) > 0) await page.locator('[data-quick-panel-chip]').click();
  await page.locator(`[data-door="${MODE}"][aria-haspopup]`).click();
  const gap = control(page, MODE, { args: { mode: 'gap' } });
  await expect(gap, 'the gap item is drawn').toBeVisible();
  await expect(gap).toHaveAttribute('aria-disabled', 'true');
  await expect(gap).toHaveAttribute('title', 'Gap — does not apply to the element');
  await expect(control(page, MODE, { args: { mode: 'padding' } }), 'the padding item, which applies, is offered').not.toHaveAttribute('aria-disabled', 'true');
  // disabled, it does nothing (the audit's AUD-35: the item's words alone): pressed, no mode comes on and no gap band
  // is drawn
  await gap.click({ force: true });
  // two frames: what a mode turned on would have drawn by then
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('[data-chrome="mode-hint"]'), 'no mode in force').toHaveCount(0);
  await expect(page.locator('[data-canvas-overlay] .chrome__band--gap'), 'no gap band').toHaveCount(0);
});

// A3.15: a mode never stays over a selection it cannot edit. The gap mode, on over a flex container, lets go the
// moment a block container is selected: the toolbar's own hint goes with it and the resize handles it hides come back.
// While it is on, the toolbar says which mode it is and how to leave it (item 4.1).
test('a mode lets go of a selection it cannot edit, and the toolbar names the mode in force', runs(OPEN, ROW, MODE, DISPLAY), async ({ page }) => {
  await openAurora(page);
  await control(page, ROW, { args: { target: 'n-grid' } }).click();
  await setDisplay(page, 'flex');
  await chooseMode(page, 'gap');
  const hint = page.locator('[data-chrome="mode-hint"]');
  await expect(hint).toHaveText('Mode: Gap · Esc exits');
  await expect(page.locator('[data-canvas-overlay] .chrome__band--gap:not(.chrome__band--auto)'), 'the gap mode pins its bands').not.toHaveCount(0);
  await expect(page.locator('[data-canvas-overlay] .chrome__handle'), 'no resize handle while a mode is on').toHaveCount(0);
  // a section lays out in block: the gap has nothing to edit there, so the mode is let go
  await control(page, ROW, { args: { target: 'n-hero' } }).click();
  await expect(hint, 'the mode is gone').toHaveCount(0);
  await expect(page.locator('[data-canvas-overlay] .chrome__band--gap'), 'and its bands with it').toHaveCount(0);
  await expect(page.locator('[data-canvas-overlay] [data-door="geometry.resize#handle-resize-e"]'), 'the resize handles are back').toHaveCount(1);
});

test('the band a drag pulls stays drawn with its live value while the pointer has left it', runs(OPEN, ROW, TOP), async ({ page }) => {
  // the dogfooding pass: an unpinned band went faint the moment the pointer moved off it, so the value changing under
  // the drag could not be read
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await control(page, ROW, { args: { target: 'n-hero' } }).click();
  const top = page.locator(`[data-canvas-overlay] [data-door="${TOP}"]`);
  const box = await top.boundingBox();
  if (box === null) throw new Error('the top padding band is not drawn');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 30, { steps: 8 });
  // the pointer now stands below the band's old edge, on the content: the band is still drawn as taken
  await expect(top, 'the dragged band is marked').toHaveClass(/is-dragging/);
  await expect(top, 'and is not the faint waiting band').not.toHaveClass(/chrome__band--auto/);
  expect(Number(await top.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.5);
  await expect(top, 'its number is the live value').not.toHaveText('56');
  await page.mouse.up();
  await expect(top, 'released, it waits again').toHaveClass(/chrome__band--auto/);
});
