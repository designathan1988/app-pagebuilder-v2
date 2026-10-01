// color-picker beyond its scenarios (spec/BEHAVIOUR.md#color-picker): the area and the hue slider are sliders the
// keyboard moves, one step with an arrow and ten with Shift (Problems in Pager 4); the picker's live colour is a gesture,
// so a reload before Apply keeps the colour from before it (autosave keeps committed work only); Previous writes back
// the colour the picker opened with, the page's when the element held none of its own. The document is read through
// the read-only test port; the page's colour through the frame's computed style.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs, setSectionOpen } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const SWATCH = 'colorPicker.open#field-color-swatch';
const VALUE = 'style.set#color-picker-value';
const HUE = 'style.set#color-picker-hue';
const AREA = 'style.set#color-picker-area';
const PREVIOUS = 'style.set#color-picker-previous';
const APPLY = 'colorPicker.apply#color-picker-apply';
const BG = 'background-color';

interface Node {
  readonly id: string;
  readonly styles: Record<string, Record<string, Record<string, string>> | undefined>;
  readonly children: readonly Node[];
}
const nodeIn = (tree: Node, id: string): Node | null => (tree.id === id ? tree : tree.children.map((c) => nodeIn(c, id)).find((n) => n !== null) ?? null);
const declared = async (page: Page, id: string): Promise<string | undefined> => {
  const document = (await page.evaluate(() => (window as unknown as Record<string, { document: () => unknown }>).__builderTestPort?.document())) as { pages: { tree: Node }[] };
  const tree = document.pages[0]?.tree;
  return (tree ? nodeIn(tree, id)?.styles.desktop?.base : undefined)?.[BG];
};
const undoSteps = (page: Page) => page.evaluate(() => ((window as unknown as Record<string, { history: () => { undoSteps: number } }>).__builderTestPort?.history().undoSteps ?? -1));
const drawn = (page: Page, id: string) => page.frameLocator('.frame__page').locator(`[data-node="${id}"]`).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), BG);

async function openProject(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-actions"]')).toHaveCount(1);
}

// the Actions div selected, its background's picker opened from the swatch, and a colour typed in the text field
async function pickerWith(page: Page, colour: string): Promise<void> {
  await control(page, ROW, { args: { target: 'n-actions' } }).click();
  await control(page, SWATCH, { args: { property: BG } }).click();
  const field = page.locator(`[data-door="${VALUE}"] input`);
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(colour);
  await page.keyboard.press('Enter');
  await expect.poll(() => declared(page, 'n-actions'), 'the typed colour is drawn live').toBe(colour);
}

test.beforeEach(async ({ page }) => {
  await openProject(page);
});

test('outside press cancels the preview before selecting another element', runs(OPEN, ROW, SWATCH, VALUE), async ({ page }) => {
  await pickerWith(page, '#ff0000');
  const row = control(page, ROW, { args: { target: 'n-title' } });
  const box = await row.boundingBox();
  if (!box) throw new Error('The title row is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('[data-region="color-picker"]')).toHaveCount(0);
  await expect(row).toBeFocused();
  await expect.poll(() => declared(page, 'n-actions')).toBeUndefined();
  expect(await undoSteps(page)).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __builderTestPort: { selection(): string[] } }).__builderTestPort.selection())).toEqual(['n-title']);
});

test('the hue and the area are sliders: an arrow moves one step, Shift ten', runs(OPEN, ROW, SWATCH, VALUE, HUE, AREA, APPLY), async ({ page }) => {
  await pickerWith(page, '#ff0000');
  // from the text field, back through the alpha slider to the hue slider, with the keyboard
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator(`[data-door="${HUE}"] input`)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  // hue 1
  await expect.poll(() => declared(page, 'n-actions')).toBe('#ff0400');
  await page.keyboard.press('Shift+ArrowRight');
  // hue 11
  await expect.poll(() => declared(page, 'n-actions')).toBe('#ff2f00');
  // back through the area's brightness to its saturation; ArrowLeft: saturation 99 %
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator(`[data-door="${AREA}"] input`).first()).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => declared(page, 'n-actions')).toBe('#ff3103');
  await control(page, APPLY).click();
  await expect.poll(() => drawn(page, 'n-actions')).toBe('rgb(255, 49, 3)');
  expect(await undoSteps(page), 'the session is one undo step').toBe(1);
});

test('a reload before Apply keeps the colour from before the picker opened', runs(OPEN, ROW, SWATCH, VALUE), async ({ page }) => {
  await pickerWith(page, '#ff0000');
  expect(await drawn(page, 'n-actions')).toBe('rgb(255, 0, 0)');
  await page.reload();
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-actions"]')).toHaveCount(1);
  expect(await declared(page, 'n-actions'), 'the live colour was never committed').toBeUndefined();
  expect(await drawn(page, 'n-actions')).toBe('rgba(0, 0, 0, 0)');
});

test('Previous writes back the colour the page showed when the element held none of its own', runs(OPEN, ROW, SWATCH, VALUE, PREVIOUS, APPLY), async ({ page }) => {
  await pickerWith(page, '#ff0000');
  await control(page, PREVIOUS, { args: { property: BG } }).click();
  await expect.poll(() => declared(page, 'n-actions')).toBe('rgba(0, 0, 0, 0)');
  await control(page, APPLY).click();
  await expect.poll(() => drawn(page, 'n-actions')).toBe('rgba(0, 0, 0, 0)');
});

// The picker says what it edits, and every colour field shows its colour (the user's real-use audit, item A3.29): the
// header names the property and the element, and a colour that is a part of a larger value — a border's, a shadow's, a
// gradient's stop — is shown as a sample chip (the picker writes a whole property, so those fields are typed).
test('the picker names the property and the element it edits', runs(OPEN, ROW, SWATCH), async ({ page }) => {
  await control(page, ROW, { args: { target: 'n-actions' } }).click();
  await control(page, SWATCH, { args: { property: BG } }).click();
  await expect(page.locator('.picker__header')).toHaveText('Background · Actions');
});

test('a colour that is a part of a larger value is shown as a sample', runs(OPEN, ROW), async ({ page }) => {
  await control(page, ROW, { args: { target: 'n-actions' } }).click();
  // the Border section is drawn collapsed while the element holds no border (item 5.1): the person opens it to see
  // the field, and this test is about the field's sample, not about which sections start open
  await setSectionOpen(page, 'border', true);
  const sample = page.locator('[data-door="style.setBorder#inspector-border-color-border-editor"] .field__sample');
  await expect(sample).toHaveCount(1);
  const type = page.locator('[data-door="style.setBorder#inspector-border-color-border-editor"] input');
  await type.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('#00aa00');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => sample.evaluate((el) => getComputedStyle(el).getPropertyValue('--swatch-colour').trim()))
    .toBe('#00aa00');
});
