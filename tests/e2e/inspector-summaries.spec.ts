// What the Style tab says of a value at a canvas zoom below 100 % (the plan's stage 3, J19): a 1 px border reads 1px
// (never the width the zoomed canvas draws), and the Shadow row's summary says the shadow the element holds, written
// as its CSS (it said "none" while the element held one). The project is opened as a person opens it.
import fs from 'node:fs';
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs, setSectionOpen } from './door.ts';

const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const SECTION = 'inspector.toggleSection#inspector-section-header';
const BORDER = 'style.setBorder#inspector-border-border-editor';

const fixture = JSON.parse(fs.readFileSync('manifest/features/fixtures/responsive-title.json', 'utf8')) as { pages: { tree: { children: { styles: Record<string, Record<string, unknown>> }[] } }[] };
const title = fixture.pages[0]?.tree.children[0];
if (title === undefined) throw new Error('the fixture has no title');
const sides = ['top', 'right', 'bottom', 'left'];
title.styles.desktop = {
  base: {
    'font-size': '48px',
    ...Object.fromEntries(sides.flatMap((side) => [[`border-${side}-width`, '1px'], [`border-${side}-style`, 'solid'], [`border-${side}-color`, '#000000']])),
    'box-shadow': [{ color: 'rgba(0, 0, 0, 0.2)', offsetX: '0px', offsetY: '2px', blur: '4px', spread: '0px', inset: false, hidden: false }],
  },
};

test('a 1px border reads 1px at a canvas zoom below 100 %, and the Shadow row says the shadow', runs(OPEN, ROW, SECTION, BORDER), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'title.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-title"]')).toHaveCount(1);
  await control(page, ROW, { args: { target: 'n-title' } }).click();
  // the canvas fits the 1440 px page in a narrower stage: its zoom is below 100 %
  const zoom = await page.locator('.frame__page').first().evaluate((el) => Number((el as HTMLElement).style.zoom));
  expect(zoom).toBeLessThan(1);
  await setSectionOpen(page, 'border', true);
  await expect(control(page, BORDER).locator('input').first()).toHaveValue(/^1px solid/);
  await setSectionOpen(page, 'effects', true);
  await expect(page.locator('.inspector-section[data-section="effects"] .concept-row__values').filter({ hasText: '0px 2px 4px' })).toHaveText('rgba(0, 0, 0, 0.2) 0px 2px 4px 0px');
});
