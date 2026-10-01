// Confirmed value fields use document history; pending typing keeps native text undo (J7).
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, openQuickPanel, runDoor, runs, setSectionOpen } from './door.ts';

interface Node {
  readonly id: string;
  readonly text: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly styles: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>>;
  readonly children: readonly Node[];
}
const read = (page: Page) => page.evaluate(() => {
  const p = (window as unknown as { __builderTestPort: { document: () => { pages: { tree: Node }[] }; history: () => { undoSteps: number } } }).__builderTestPort;
  return { document: p.document(), undoSteps: p.history().undoSteps };
});
const find = (node: Node): Node | undefined => node.id === 'n-intro' ? node : node.children.map(find).find(Boolean);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, 'project.open#menu-file');
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync('manifest/features/fixtures/aurora.json') });
  await control(page, 'selection.select#layers-row', { args: { target: 'n-intro' } }).click();
});

const cases = [
  { name: 'number', door: 'style.set#inspector-font-size', value: '32px', property: 'font-size', tab: 'style' },
  { name: 'style text', door: 'style.set#inspector-font-family', value: 'Georgia', property: 'font-family', tab: 'style' },
  { name: 'element text', door: 'text.set#inspector-text', value: 'A confirmed introduction', property: 'text', tab: 'settings' },
  { name: 'attribute', door: 'element.setId#inspector-id', value: 'intro-copy', property: 'id', tab: 'settings' },
  { name: 'quick panel', door: 'style.set#quick-panel-width', value: '420px', property: 'width', tab: 'quick' },
] as const;

for (const item of cases) {
  test(`${item.name} field forwards confirmed undo and both redo chords without reapplying on blur`, runs('project.open#menu-file', 'selection.select#layers-row', item.door, 'history.undo#key-ctrl-z-in-global', 'history.redo#key-ctrl-shift-z-in-global', 'history.redo#key-ctrl-y-in-global'), async ({ page }) => {
    if (item.tab === 'quick') await openQuickPanel(page);
    else {
      await runDoor(page, `workspace.setActiveTab#inspector-tab-${item.tab}`);
      if (item.tab === 'style') await setSectionOpen(page, 'text', true);
    }
    const field = control(page, item.door).locator('input, textarea').first();
    const before = await read(page);
    await field.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(item.value);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await read(page)).undoSteps).toBe(before.undoSteps + 1);
    const kept = await read(page);
    const node = find(kept.document.pages[0]?.tree as Node);
    expect(item.property === 'text' ? node?.text : item.property === 'id' ? node?.attributes.id : node?.styles.desktop?.base?.[item.property]).toBe(item.value);
    await expect(field).toBeFocused();
    // Undoing pending typing keeps its native redo available even when the field again equals the document.
    for (const redo of ['Control+Shift+z', 'Control+y']) {
      await page.keyboard.press('End');
      await page.keyboard.type('9');
      await page.keyboard.press('Control+z');
      await expect(field).toHaveValue(item.value);
      await page.keyboard.press(redo);
      await expect(field).toHaveValue(`${item.value}9`);
      expect(await read(page)).toEqual(kept);
      await page.keyboard.press('Control+z');
      await expect(field).toHaveValue(item.value);
    }
    for (const redo of ['Control+Shift+z', 'Control+y']) {
      await page.keyboard.press('Control+z');
      await expect.poll(() => read(page)).toEqual(before);
      await expect(field).toBeFocused();
      await page.keyboard.press(redo);
      await expect.poll(() => read(page)).toEqual(kept);
    }
    await page.keyboard.press('Control+z');
    await expect.poll(() => read(page)).toEqual(before);
    await page.keyboard.press('Tab');
    expect(await read(page)).toEqual(before);
  });
}

test('pending typing undoes locally before the next undo reaches the document', runs('style.set#inspector-font-size', 'history.undo#key-ctrl-z-in-global'), async ({ page }) => {
  await setSectionOpen(page, 'text', true);
  const field = control(page, 'style.set#inspector-font-size').locator('input').first();
  await field.click();
  await page.keyboard.type('32px');
  await page.keyboard.press('Enter');
  const kept = await read(page);
  await page.keyboard.press('End');
  await page.keyboard.type('9');
  await page.keyboard.press('Control+z');
  await expect(field).toHaveValue('32px');
  expect(await read(page)).toEqual(kept);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await read(page)).undoSteps).toBe(kept.undoSteps - 1);
});

test('an immediate undo after Enter needs no extra click or wait', runs('style.set#inspector-font-size', 'history.undo#key-ctrl-z-in-global'), async ({ page }) => {
  await setSectionOpen(page, 'text', true);
  const before = await read(page);
  const field = control(page, 'style.set#inspector-font-size').locator('input').first();
  await field.click();
  await page.keyboard.type('32px');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+z');
  await expect.poll(() => read(page)).toEqual(before);
  await expect(field).toBeFocused();
});

test('undo in the property search never changes document history', runs('style.set#inspector-font-size', 'inspector.search#inspector-search-field'), async ({ page }) => {
  await setSectionOpen(page, 'text', true);
  const field = control(page, 'style.set#inspector-font-size').locator('input').first();
  await field.click();
  await page.keyboard.type('32px');
  await page.keyboard.press('Enter');
  const before = await read(page);
  const search = control(page, 'inspector.search#inspector-search-field').locator('input');
  await search.click();
  await page.keyboard.type('font');
  await page.keyboard.press('Control+z');
  expect(await read(page)).toEqual(before);
  await expect(search).toBeFocused();
});
