// An easing field's curve (spec easing-curve; the plan's stage 3): the ready-made curves are chosen by their drawing,
// and a Bézier typed by its control points is used — and only it: the layer, drawn on the body, stands in the field's
// form in React's tree, and its submit once also submitted the field with the value the field showed before (the
// action went back to ease-out).
import fs from 'node:fs';
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';

const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const TAB = 'workspace.setActiveTab#inspector-tab-interactions';
const ADD = 'motion.add#inspector-motion-add';
const PANEL = 'workspace.setPanelOpen#status-bar-motion';
const BAR = 'motion.select#timeline-motion-bar';
const EASING = 'motion.updateAction#timeline-motion-action-easing';

test('a ready-made curve and a Bézier of its own are chosen from the curve, and the field keeps the last', runs(OPEN, ROW, TAB, ADD, PANEL, BAR, EASING), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'motion.json', mimeType: 'application/json', buffer: fs.readFileSync('manifest/features/fixtures/motion.json') });
  await control(page, ROW, { args: { target: 'n-hero' } }).click();
  await runDoor(page, TAB);
  await runDoor(page, ADD);
  await runDoor(page, PANEL);
  await control(page, BAR).first().click();
  const field = control(page, EASING).locator('input.panel-field__text');
  const curve = control(page, EASING).locator('.easing-curve__button');
  await curve.click();
  await page.locator('.easing-preset[title="ease-in-out"]').click();
  await expect(field).toHaveValue('ease-in-out');
  await curve.click();
  await page.locator('.easing-popover__point').nth(1).locator('input').fill('1.6');
  await page.locator('.easing-popover__points button[type="submit"]').click();
  await expect(field).toHaveValue('cubic-bezier(0.42, 1.6, 0.58, 1)');
});
