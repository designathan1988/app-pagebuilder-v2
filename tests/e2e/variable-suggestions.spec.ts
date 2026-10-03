// css-variables-tokens beyond its scenarios (spec/BEHAVIOUR.md#css-variables-tokens, WISH-10): the suggestions a name
// begun after -- opens list the variables of the field's own kind only (a length field the lengths), the field keeps
// the focus while a variable is pressed, and the browser's own list of a colour field no longer offers the variables
// twice. Read in Chrome: what the list draws, where the focus is, what the datalist holds.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, openStyleControl, runDoor, runs, openExplorer } from './door.ts';

const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const WIDTH = 'style.set#inspector-width';
const COLOR = 'style.set#inspector-color';

async function openTones(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const project = JSON.parse(fs.readFileSync('manifest/features/fixtures/aurora.json', 'utf8'));
  project.tokens = [
    { name: 'gap', kind: 'length', value: '240px' },
    { name: 'grain', kind: 'length', value: '320px' },
    { name: 'brand', kind: 'color', value: '#0b7f72' },
  ];
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'tones.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await openExplorer(page);
  await control(page, ROW, { args: { target: 'n-intro' } }).click();
}
const intro = (page: Page) =>
  page.evaluate(() => {
    type Node = { id: string; styles: { desktop?: { base?: Record<string, string> } }; children: Node[] };
    const find = (node: Node): Node | undefined => (node.id === 'n-intro' ? node : node.children.map(find).find((one) => one !== undefined));
    const tree = (window as unknown as { __builderTestPort: { document(): { pages: { tree: Node }[] } } }).__builderTestPort.document().pages[0]?.tree as Node;
    return find(tree)?.styles.desktop?.base ?? {};
  });

test('a length field lists only the length variables a name begins, and Enter writes the active one', runs(OPEN, ROW, WIDTH, 'focus.activate#key-enter-in-field-suggestions'), async ({ page }) => {
  await openTones(page);
  await openStyleControl(page, WIDTH);
  const field = page.locator(`[data-door="${WIDTH}"] input`).first();
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('--g');
  const options = page.getByRole('listbox').getByRole('option');
  await expect(options).toHaveText(['var(--gap)', 'var(--grain)']);
  // the field is the list's combobox, its first variable active, and keeps the focus
  await expect(field).toHaveAttribute('role', 'combobox');
  await expect(field).toHaveAttribute('aria-activedescendant', (await options.first().getAttribute('id')) ?? '');
  await expect(field).toBeFocused();
  // a name more: the list follows the typing
  await page.keyboard.type('r');
  await expect(options).toHaveText(['var(--grain)']);
  await page.keyboard.press('Enter');
  await expect.poll(() => intro(page).then((base) => base.width)).toBe('var(--grain)');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  // closed, the field is a spin button again
  await expect(field).toHaveAttribute('role', 'spinbutton');
});

test('a press on a variable writes it and leaves the focus in the field', runs(OPEN, ROW, WIDTH), async ({ page }) => {
  await openTones(page);
  await openStyleControl(page, WIDTH);
  const field = page.locator(`[data-door="${WIDTH}"] input`).first();
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('--');
  await page.getByRole('option', { name: 'var(--gap)' }).click();
  await expect.poll(() => intro(page).then((base) => base.width)).toBe('var(--gap)');
  await expect(field).toBeFocused();
});

test('the colour field’s own list keeps the keywords and leaves the variables to the suggestions', runs(OPEN, ROW, COLOR), async ({ page }) => {
  await openTones(page);
  await openStyleControl(page, COLOR);
  const field = page.locator(`[data-door="${COLOR}"] input`).first();
  const listed = await field.evaluate((input) => [...((input as HTMLInputElement).list?.options ?? [])].map((option) => option.value));
  expect(listed.some((value) => value.startsWith('var(')), 'no variable in the browser’s list').toBe(false);
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('var(--b');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['var(--brand)']);
});
