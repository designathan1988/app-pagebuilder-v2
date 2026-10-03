// app-menu beyond its scenarios (spec/BEHAVIOUR.md#app-menu): a menu opened from its button takes the focus on its
// first item, the arrows move the focus, and Escape closes the menu and gives the focus back to its button (Enter on
// the button is keyboard-panel-navigation's, finding 48); with nothing selected, Arrange's items that need a
// selection are disabled and say why (Problems in Pager 4), and a click on one changes nothing.
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { runs } from './door.ts';

const DUPLICATE = 'element.duplicate#menu-edit';
const MOVE_UP = 'element.moveUp#menu-arrange';
type Port = { document: () => unknown };
const documentNow = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.stringify((window as unknown as { __builderTestPort: Port }).__builderTestPort.document()));

test('an open menu moves and closes from the keyboard, and gives the focus back to its button', runs(), async ({ page }) => {
  await openEditor(page);
  const edit = page.locator('.menu-button[data-menu="edit"]');
  await edit.click();
  const items = page.locator('[role="menu"] [role^="menuitem"]');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
  await expect(edit).toBeFocused();
});

test('with nothing selected, a menu item that needs a selection is disabled, says why, and does nothing', runs(MOVE_UP, DUPLICATE), async ({ page }) => {
  await openEditor(page);
  const before = await documentNow(page);
  await page.locator('.menu-button[data-menu="arrange"]').click();
  const moveUp = page.locator(`[data-door="${MOVE_UP}"]`);
  await expect(moveUp).toHaveAttribute('aria-disabled', 'true');
  const reason = await moveUp.getAttribute('title');
  expect(reason ?? '').not.toBe('');
  expect(reason).not.toContain('not available yet');
  await moveUp.click({ force: true });
  expect(await documentNow(page)).toBe(before);
});

// The menu bar from the keyboard (spec app-menu; the audit's U-033): F10 opens File, the arrows go to the next and the
// previous menu, and on an item that leads to a submenu ArrowRight opens it and ArrowLeft closes it, back on its item.
test('F10 opens the menu bar, the arrows walk its menus, and open and close a submenu', runs('focus.menuBar#key-f10-in-global', 'focus.nextMenu#key-arrow-right-in-menu', 'focus.previousMenu#key-arrow-left-in-menu'), async ({ page }) => {
  await openEditor(page);
  const open = () => page.locator('.top-bar__menus [data-menu][aria-expanded="true"]').getAttribute('data-menu');
  await page.keyboard.press('F10');
  await expect.poll(open).toBe('file');
  await page.keyboard.press('ArrowRight');
  await expect.poll(open).toBe('edit');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(open).toBe('file');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(open).toBe('help');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(open).toBe('view');
  // the View menu's Theme leads to a submenu
  const theme = page.locator('.menu__sub > [aria-haspopup="menu"]').first();
  await theme.focus();
  await page.keyboard.press('ArrowRight');
  await expect(theme).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.menu__sub .menu') !== null)).toBe(true);
  await page.keyboard.press('ArrowLeft');
  await expect(theme).toHaveAttribute('aria-expanded', 'false');
  await expect(theme).toBeFocused();
});

test('with a menu open, the pointer onto another menu button opens that one; with none open, hovering opens nothing', runs(), async ({ page }) => {
  // the dogfooding pass: each application menu wanted its own click
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const centre = async (menu: string) => {
    const box = await page.locator(`[data-menu="${menu}"]`).boundingBox();
    if (box === null) throw new Error(`no ${menu} menu`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const file = await centre('file');
  await page.mouse.click(file.x, file.y);
  await expect(page.locator('[data-menu="file"]')).toHaveAttribute('aria-expanded', 'true');
  const edit = await centre('edit');
  await page.mouse.move(edit.x, edit.y, { steps: 6 });
  await expect(page.locator('[data-menu="edit"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-menu="file"]')).toHaveAttribute('aria-expanded', 'false');
  // the menus themselves, beyond their buttons' words (the audit's AUD-35): Edit's is drawn with its items, File's is gone
  await expect(page.getByRole('menu', { name: 'Edit' }).getByRole('menuitem').first()).toBeVisible();
  await expect(page.getByRole('menu', { name: 'File' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const view = await centre('view');
  await page.mouse.move(view.x, view.y, { steps: 6 });
  await expect(page.locator('[data-menu][aria-expanded="true"]')).toHaveCount(0);
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('a menu the pointer opened on its way stays open under the click that follows; a second click closes it', runs(), async ({ page }) => {
  // the complete suite caught it: moving to Edit opened it, and the click the person moved there for closed it
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await page.locator('.menu-button[data-menu="file"]').click();
  await page.locator('.menu-button[data-menu="edit"]').click();
  await expect(page.getByRole('menu', { name: 'Edit' })).toBeVisible();
  // open under the click, it works (the audit's AUD-35: drawn alone proved no use): the keys move through its items
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="menu"]')?.getAttribute('aria-label') ?? null)).toBe('Edit');
  await page.locator('.menu-button[data-menu="edit"]').click();
  await expect(page.getByRole('menu', { name: 'Edit' })).toHaveCount(0);
});

test('a slow continuous crossing of Edit keeps File open and saves the project', runs(), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await page.locator('[data-menu="file"]').click();
  const save = await page.locator('[data-door="project.save#menu-file"]').boundingBox();
  const edit = await page.locator('[data-menu="edit"]').boundingBox();
  if (save === null || edit === null) throw new Error('The menu controls are not drawn');
  await page.mouse.move(edit.x + 3, edit.y + 3);
  // Continuous small movements over at least 300 ms: no interval approaches the 150 ms resting threshold.
  for (let step = 1; step <= 12; step += 1) {
    await page.waitForTimeout(25);
    await page.mouse.move(edit.x + 3 + (edit.width - 6) * step / 12, edit.y + 3 + (edit.height - 6) * step / 12);
  }
  await expect(page.getByRole('menu', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('menu', { name: 'File' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.mouse.click(save.x + save.width / 2, save.y + save.height / 2);
  expect((await download).suggestedFilename()).toBe('project.zip');
  await expect(page.locator('.status-bar__message')).not.toContainText('Undone');
});

test("a pointer crossing another menu's button on its way into the open menu clicks the item it went to", runs(), async ({ page }) => {
  // the journey "site": File open, the pointer went down-right to Save project over Edit; Edit opened and the click
  // landed on Undo, which undid the last change and saved nothing (spec app-menu; interactions.json menus.hoverSwitch)
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const box = async (selector: string) => {
    const b = await page.locator(selector).boundingBox();
    if (b === null) throw new Error(`${selector} is not drawn`);
    return b;
  };
  const file = await box('[data-menu="file"]');
  await page.mouse.click(file.x + file.width / 2, file.y + file.height / 2);
  const save = await box('[data-door="project.save#menu-file"]');
  const edit = await box('[data-menu="edit"]');
  const to = { x: save.x + save.width / 2, y: save.y + save.height / 2 };
  // the path really crosses Edit's button
  expect(to.x).toBeGreaterThan(edit.x);
  const download = page.waitForEvent('download');
  await page.mouse.move(edit.x + edit.width / 2, edit.y + edit.height - 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.click(to.x, to.y);
  expect((await download).suggestedFilename()).toBe('project.zip');
  await expect(page.locator('.status-bar__message')).not.toContainText('Undone');
});
