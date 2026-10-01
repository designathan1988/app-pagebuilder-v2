import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs, setSectionOpen } from './door.ts';

const FONT = 'style.set#inspector-font-family';
const FAMILY = "Georgia, 'Times New Roman', serif";
const field = (page: Page) => page.locator(`[data-door="${FONT}"] input`).first();
const trigger = (page: Page) => page.locator(`[data-door="${FONT}"] button[aria-haspopup="menu"]`).first();
const read = (page: Page) => page.evaluate(() => {
  const p = (window as unknown as { __builderTestPort: { document(): unknown; history(): { undoSteps: number } } }).__builderTestPort;
  return { document: p.document(), undoSteps: p.history().undoSteps };
});
test.beforeEach(async ({ page }) => {
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, 'project.open#menu-file');
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync('manifest/features/fixtures/aurora.json') });
  await control(page, 'selection.select#layers-row', { args: { target: 'n-intro' } }).click();
  await setSectionOpen(page, 'text', true);
});

test('opening and exploring the font list leaves the unfinished text uncommitted', runs(FONT), async ({ page }) => {
  const before = await read(page);
  await field(page).fill('Ge');
  await trigger(page).click();
  await expect(page.locator('.field__menu:visible')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await read(page)).toEqual(before);
  await expect(field(page)).toHaveValue('Ge');
});

for (const choose of ['mouse', 'keyboard']) {
  test(`choosing a font by ${choose} replaces the draft in exactly one undo step`, runs(FONT), async ({ page }) => {
    const before = await read(page);
    await field(page).fill('Ge');
    await trigger(page).click();
    const option = page.locator('.field__menu:visible [role="menuitemradio"]').filter({ hasText: 'Georgia' }).first();
    if (choose === 'mouse') await option.click();
    else {
      for (let i = 0; i < 30 && !(await option.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('ArrowDown');
      await expect(option).toBeFocused();
      await page.keyboard.press('Enter');
    }
    await expect(field(page)).toHaveValue(FAMILY);
    await expect.poll(async () => (await read(page)).undoSteps).toBe(before.undoSteps + 1);
    await page.keyboard.press('Control+z');
    await expect.poll(() => read(page)).toEqual(before);
  });
}

test('Escape returns to the unchanged draft; Tab confirms it once', runs(FONT), async ({ page }) => {
  const before = await read(page);
  await field(page).fill('Georgia');
  await trigger(page).click();
  await page.keyboard.press('Escape');
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('Georgia');
  expect(await read(page)).toEqual(before);
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await read(page)).undoSteps).toBe(before.undoSteps + 1);
});

test('an outside click commits the draft for its original element and selects the clicked row', runs(FONT, 'selection.select#layers-row'), async ({ page }) => {
  const before = await read(page);
  await field(page).fill('Georgia');
  await trigger(page).click();
  await control(page, 'selection.select#layers-row', { args: { target: 'n-title' } }).click();
  await expect.poll(async () => (await read(page)).undoSteps).toBe(before.undoSteps + 1);
  const result = await page.evaluate(() => {
    const p = (window as unknown as { __builderTestPort: { document(): { pages: { tree: { children: { id: string; children: { id: string; styles: { desktop?: { base?: Record<string, string> } } }[] }[] } }[] }; selection(): string[] } }).__builderTestPort;
    return { children: p.document().pages[0]?.tree.children.find(n => n.id === 'n-hero')?.children, selection: p.selection() };
  });
  expect(result.selection).toEqual(['n-title']);
  expect(result.children?.find(n => n.id === 'n-intro')?.styles.desktop?.base?.['font-family']).toBe('Georgia');
  expect(result.children?.find(n => n.id === 'n-title')?.styles.desktop?.base?.['font-family']).toBeUndefined();
});

for (const key of ['Tab', 'Shift+Tab']) {
  test(`${key} leaves the open font list and confirms the draft once`, runs(FONT), async ({ page }) => {
    const before = await read(page);
    await field(page).fill('Georgia');
    await trigger(page).click();
    await page.keyboard.press(key);
    await expect(page.locator('.field__menu:visible')).toHaveCount(0);
    await expect.poll(async () => (await read(page)).undoSteps).toBe(before.undoSteps + 1);
  });
}

test('reloading while exploring the font list recovers the unconfirmed draft', runs(FONT), async ({ page }) => {
  const before = await read(page);
  await field(page).fill('Ge');
  await trigger(page).click();
  page.once('dialog', d => d.accept());
  await page.reload();
  await expect(field(page)).toHaveValue('Ge');
  await expect(field(page)).toBeFocused();
  expect(await read(page)).toEqual(before);
});
