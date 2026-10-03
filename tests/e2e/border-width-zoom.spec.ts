// A border field shows the width the page gives the element, whatever the canvas zoom (spec inspector-provenance-reset,
// Problems in Pager 4; BW1, found by the inspector text test: a button's 1 px border read "1.69014px solid …" at the
// fit zoom). The browser snaps a line's width to whole device pixels and reports it divided by the zoom, so the field
// reads the width the page's stylesheets declare (the base stylesheet's 1 px for a button) or the browser's own (an
// inline frame's 2 px inset), the same at the fit zoom and at 100 %.
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs, setSectionOpen } from './door.ts';

const INSERT = 'element.insert#elements-tile';
const BORDER = 'style.setBorder#inspector-border-border-editor';
const ZOOM_100 = 'view.zoomTo#menu-zoom-100';
const ALL = 'inspector.setMode#inspector-mode-all';

const zoom = (page: Page) => page.locator('.frame__page').evaluate((el) => (el as HTMLIFrameElement).currentCSSZoom);
// what the Border field shows while the element holds no border of its own
const shown = (page: Page) => control(page, BORDER).locator('.field__rest-value').first().textContent();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
});

for (const [entry, width] of [['button', '1px solid'], ['embedded-frame', '2px inset']] as const) {
  test(`the Border field of a new ${entry} reads ${width} at the fit zoom and at 100 %`, runs(INSERT, ALL, BORDER, ZOOM_100), async ({ page }) => {
    await control(page, INSERT, { args: { entry } }).click();
    await runDoor(page, ALL);
    await setSectionOpen(page, 'border', true);
    // the fit zoom of a 1440 px page in this window is no whole zoom, so the canvas snaps a 1 px line
    expect(await zoom(page)).toBeLessThan(0.9);
    await expect.poll(() => shown(page)).toMatch(new RegExp(`^${width} `, 'u'));
    await runDoor(page, ZOOM_100);
    await expect.poll(() => zoom(page)).toBeCloseTo(1, 2);
    await expect.poll(() => shown(page)).toMatch(new RegExp(`^${width} `, 'u'));
  });
}
