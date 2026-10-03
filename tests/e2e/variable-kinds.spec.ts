// New variable's list of kinds is reached from the keyboard (spec css-variables-tokens; the audit's AUD-26: the + opened
// the list and kept the focus, so the kinds could only be clicked). The + opens a listbox whose first kind takes the
// focus; the arrows, Home and End move it among the kinds; Escape closes the list and gives the focus back to the +;
// Enter on a kind makes a variable of that kind, whose name field takes the focus. The document is read through the
// test port.
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { runDoor, runs } from './door.ts';

const STYLES = 'workspace.setPanelOpen#toolbar-activity-bar-styles';
const ADD = 'tokens.create#variables-add';

const tokens = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as Record<string, { document: () => { tokens?: { name: string; kind: string }[] } }>).__builderTestPort;
    return (p?.document().tokens ?? []).map((t) => ({ name: t.name, kind: t.kind }));
  });
// the kind the focused control stands for, or null when the focus is on no kind
const focusedKind = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute('role') === 'option' ? (JSON.parse(el.getAttribute('data-args') ?? '{}') as { kind?: string }).kind ?? null : null;
  });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await runDoor(page, STYLES);
  await expect(page.locator('[data-region="styles"]')).toBeVisible();
});

test('the + opens the kinds with the first focused, the arrows move among them, Escape gives the focus back, and Enter makes one', runs(STYLES, ADD), async ({ page }) => {
  const add = page.locator(`[data-door="${ADD}"][aria-haspopup="listbox"]`);
  const list = page.getByRole('listbox', { name: 'New variable' });
  // the view opened is entered on its content, the + (spec keyboard-panel-navigation), two frames after it is drawn
  await expect(add).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(list).toBeVisible();
  await expect(add).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => focusedKind(page)).toBe('color');

  await page.keyboard.press('ArrowDown');
  expect(await focusedKind(page)).toBe('length');
  await page.keyboard.press('End');
  expect(await focusedKind(page)).toBe('font-size');
  await page.keyboard.press('ArrowDown');
  expect(await focusedKind(page)).toBe('color');
  await page.keyboard.press('ArrowUp');
  expect(await focusedKind(page)).toBe('font-size');
  await page.keyboard.press('Home');
  expect(await focusedKind(page)).toBe('color');

  // Escape closes the list and the focus is back on the +, so nothing was made
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect(add).toHaveAttribute('aria-expanded', 'false');
  expect(await tokens(page)).toEqual([]);

  // Enter on the second kind makes a size variable, and its name field takes the focus
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedKind(page)).toBe('color');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(list).toHaveCount(0);
  await expect.poll(() => tokens(page)).toEqual([{ name: 'length-1', kind: 'length' }]);
  await expect(page.locator('[data-region="styles"] input:focus')).toHaveValue('length-1');
});
