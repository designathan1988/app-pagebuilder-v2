// The canonical design's twelve states (design/final/index.html, its #state=…) and how the app is brought to each with
// the gestures a person makes, on the cards-class project: what the parity tools pair (pair.ts crops the regions,
// pairing.parity.ts measures every region and control).
import type { Page } from '@playwright/test';
import { openMenu } from '../../tests/e2e/door.ts';

export const STATES = ['default', 'selection', 'breakpoint', 'menu', 'context', 'palette', 'multi', 'state', 'text', 'interaction', 'hover', 'drag'] as const;
export type State = (typeof STATES)[number];
export type Theme = 'dark' | 'light';
export type Language = 'en' | 'pt-BR';
export const CANON = 'http://localhost:5394/design/final/index.html';
export const FIXTURE = 'manifest/features/fixtures/cards-class.json';

// the design at a state, its theme and language from its address (its own control reloads the page with them)
export async function openCanon(canon: Page, state: State, theme: Theme, language: Language): Promise<void> {
  await canon.goto(`${CANON}#state=${state}&theme=${theme}&lang=${language === 'en' ? 'en' : 'pt'}`);
  await canon.waitForTimeout(1500);
  await canon.evaluate(() => document.querySelector('.mock-ctl')?.remove());
  await canon.waitForTimeout(400);
}

// the app opened on the cards-class project, in a theme and a language chosen as a person chooses them
export async function openApp(app: Page, base: string, theme: Theme, language: Language): Promise<void> {
  await app.goto(base);
  await app.waitForTimeout(1200);
  await app.locator('[data-menu="file"]').click();
  const chooser = app.waitForEvent('filechooser');
  await app.locator('[data-door="project.open#menu-file"]').click();
  await (await chooser).setFiles(FIXTURE);
  // opening a project may start the editor again on it: the page settles first
  await app.waitForTimeout(1500);
  await app.waitForLoadState('load');
  await app.locator('.workbench').waitFor();
  if (theme === 'light') await choose(app, 'theme', 'preferences.setTheme#menu-theme-light');
  if (language === 'pt-BR') await choose(app, 'language', 'preferences.setLanguage#menu-language-pt-br');
}

// a submenu's item (View › Theme, View › Language), opened as the menus open it (tests/e2e/door.ts openMenu)
async function choose(app: Page, submenu: 'theme' | 'language', door: string): Promise<void> {
  await openMenu(app, submenu);
  await app.locator(`[data-door="${door}"]`).first().click();
  await app.waitForTimeout(300);
}

// the app brought to a state of the design, as a person brings it there
export async function setUpState(app: Page, state: State): Promise<void> {
  const card = (name: string) => app.locator('[data-door="selection.select#layers-row"]', { hasText: name }).first();
  // the sidebar's view the design shows in the state (its Styles view in the State state, else the Explorer), opened
  // from the activity bar: a fresh profile opens on Insert (the audit's AUD-21), which the design does not show
  await app.locator(`[data-door="workspace.setPanelOpen#toolbar-activity-bar-${state === 'state' ? 'styles' : 'explorer'}"]`).click();
  await app.waitForTimeout(300);
  if (state !== 'default') {
    await card('CardA').click();
    await app.waitForTimeout(500);
  }
  // the design's Tablet state shows the quick panel open on the selection: the app at Tablet with its panel open too
  if (state === 'breakpoint') {
    await app.locator('[data-door="view.setBreakpoint#toolbar-breakpoint-tabs-tablet"]').click();
    await app.waitForTimeout(500);
    await app.keyboard.press('Control+Shift+Q');
    await app.waitForTimeout(600);
  }
  if (state === 'menu') {
    await app.locator('[data-menu="arrange"]').click();
    await app.waitForTimeout(400);
  }
  if (state === 'context') {
    await card('CardA').click({ button: 'right' });
    await app.waitForTimeout(400);
  }
  if (state === 'palette') {
    await app.keyboard.press('Control+K');
    await app.waitForTimeout(300);
    // the canonical palette shows the query exp
    await app.keyboard.type('exp');
    await app.waitForTimeout(400);
  }
  if (state === 'multi') {
    await card('CardB').click({ modifiers: ['Control'] });
    await card('CardC').click({ modifiers: ['Control'] });
    await app.waitForTimeout(400);
  }
  if (state === 'state') {
    // the State picker of the selector bar, then its Hover item, as a person picks it
    await app.locator('.state-picker').first().click();
    await app.locator('[data-door$="#menu-style-state-hover"]').first().click();
    await app.waitForTimeout(400);
  }
  if (state === 'text') {
    // the card's title edited in place: selected, then a double-click on its words, as a person starts editing it
    await card('CardATitle').click();
    await app.waitForTimeout(400);
    const words = await app.locator('.chrome__selection').first().boundingBox();
    if (words === null) throw new Error('the card title is not drawn selected');
    await app.mouse.dblclick(words.x + Math.min(words.width / 2, 20), words.y + words.height / 2);
    await app.waitForTimeout(500);
  }
  if (state === 'interaction') {
    await app.locator('[data-door$="#inspector-tab-interactions"]').first().click();
    await app.waitForTimeout(400);
    // an event made on the element, as the canonical tab shows one (its first item: On click)
    const add = app.locator('[data-region="inspector-interactions"] button[aria-haspopup]').first();
    if ((await add.count()) > 0) {
      await add.click();
      await app.waitForTimeout(300);
      const first = app.locator('[role="menu"] [role^="menuitem"]').first();
      if ((await first.count()) > 0) await first.click();
      await app.waitForTimeout(400);
    }
  }
  if (state === 'hover') {
    // CardA selected, the pointer below it with Alt held: the distance to what is under it (the canonical measurement)
    const other = await app.locator('.chrome__selection').first().boundingBox();
    if (other !== null) {
      await app.mouse.move(other.x + other.width / 2, other.y + other.height + 40);
      await app.keyboard.down('Alt');
      await app.waitForTimeout(400);
    }
  }
  if (state === 'drag') {
    // CardA dragged by the pointer and held midway (the canonical drag: the insertion line and the ghost)
    const from = await app.locator('.chrome__selection').first().boundingBox();
    if (from !== null) {
      await app.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await app.mouse.down();
      await app.mouse.move(from.x + from.width / 2, from.y + from.height + 60, { steps: 12 });
      await app.waitForTimeout(400);
    }
  }
  // the pointer rests where it hovers nothing (a menu stays open: the pointer leaving it does not close it)
  if (state !== 'palette' && state !== 'hover' && state !== 'drag') await app.mouse.move(1, 899);
}
