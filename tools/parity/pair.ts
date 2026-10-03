// The pairing of the app with the canonical design (the plan's stage 0.4 and stage 5): both opened at 1440 × 900 in one
// state, each region the two mark with the same data-region cropped from each, the canonical's above the app's, into
// .cache/logs/parity-<time>/<state>-<region>-canon.png and -app.png, with what the region measures on each side (its
// box, its background, its text colour) in report.txt. Run: node tools/parity/pair.ts [state], the design served on
// 5394 (launch.json design-static) and the app on PORT (5320).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';

const STATE = process.argv[2] ?? 'selection';
// the theme both are shown in (third argument: dark, the default, or light)
const THEME = process.argv[3] ?? 'dark';
const APP = `http://localhost:${process.env.PORT ?? '5320'}/`;
const CANON = 'http://localhost:5394/design/final/index.html';
const out = path.join('.cache/logs', `parity-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const canon = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
// the design's state is its address's (#state=…; its own control reloads the page with it)
await canon.goto(`${CANON}#state=${STATE}&theme=${THEME}&lang=en`);
await canon.waitForTimeout(1500);
await canon.evaluate(() => document.querySelector('.mock-ctl')?.remove());
await canon.waitForTimeout(400);

const app = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
await app.goto(APP);
await app.waitForTimeout(1200);
await app.locator('[data-menu="file"]').click();
const chooser = app.waitForEvent('filechooser');
await app.locator('[data-door="project.open#menu-file"]').click();
await (await chooser).setFiles('manifest/features/fixtures/cards-class.json');
// opening a project may start the editor again on it: the page settles first
await app.waitForTimeout(1500);
await app.waitForLoadState('load');
await app.locator('.workbench').waitFor();
// the app's theme chosen as a person chooses it (View › Theme)
if (THEME === 'light') {
  await app.locator('[data-menu="view"]').click();
  // Theme is a submenu: the pointer rests on it, then its Light item
  await app.locator('[role="menuitem"]', { hasText: 'Theme' }).first().hover();
  await app.locator('[data-door="preferences.setTheme#menu-theme-light"]').first().click();
  await app.waitForTimeout(300);
}
if (STATE !== 'default') {
  await app.locator('[data-door="selection.select#layers-row"]', { hasText: 'CardA' }).first().click();
  await app.waitForTimeout(500);
}
// the design's Tablet state shows the quick panel open on the selection: the app at Tablet with its panel open too
if (STATE === 'breakpoint') {
  await app.locator('[data-door="view.setBreakpoint#toolbar-breakpoint-tabs-tablet"]').click();
  await app.waitForTimeout(500);
  await app.keyboard.press('Control+Shift+Q');
  await app.waitForTimeout(600);
}

// the other canonical states, each set up on the app with the gestures a person would make
const card = (name: string) => app.locator('[data-door="selection.select#layers-row"]', { hasText: name }).first();
if (STATE === 'menu') {
  await app.locator('[data-menu="arrange"]').click();
  await app.waitForTimeout(400);
}
if (STATE === 'context') {
  await card('CardA').click({ button: 'right' });
  await app.waitForTimeout(400);
}
if (STATE === 'palette') {
  await app.keyboard.press('Control+K');
  await app.waitForTimeout(300);
  // the canonical palette shows the query exp
  await app.keyboard.type('exp');
  await app.waitForTimeout(400);
}
if (STATE === 'multi') {
  await card('CardB').click({ modifiers: ['Control'] });
  await card('CardC').click({ modifiers: ['Control'] });
  await app.waitForTimeout(400);
}
if (STATE === 'state') {
  // the State picker of the selector bar, then its Hover item, as a person picks it
  await app.locator('.state-picker').first().click();
  await app.locator('[data-door$="#menu-style-state-hover"]').first().click();
  await app.waitForTimeout(400);
}
if (STATE === 'text') {
  // the card's title edited in place: selected, then a double-click on its words (the selection's box the canvas
  // draws), as a person starts editing its text
  await card('CardATitle').click();
  await app.waitForTimeout(400);
  const words = await app.locator('.chrome__selection').first().boundingBox();
  if (words === null) throw new Error('the card title is not drawn selected');
  await app.mouse.dblclick(words.x + Math.min(words.width / 2, 20), words.y + words.height / 2);
  await app.waitForTimeout(500);
}
if (STATE === 'interaction') {
  await app.locator('[data-door$="#inspector-tab-interactions"]').first().click();
  await app.waitForTimeout(400);
  // an event made on the element, as the canonical tab shows one (its first item: On click)
  const add = app.locator('[data-region="inspector-interactions"] button', { hasText: 'Add' }).first();
  if ((await add.count()) > 0) {
    await add.click();
    await app.waitForTimeout(300);
    const first = app.locator('[role="menu"] [role^="menuitem"]').first();
    if ((await first.count()) > 0) await first.click();
    await app.waitForTimeout(400);
  }
}
if (STATE === 'hover') {
  // CardA selected, the pointer over CardB with Alt held: the distance between them (the canonical measurement)
  const other = await app.locator('.chrome__selection').first().boundingBox();
  if (other !== null) {
    await app.mouse.move(other.x + other.width / 2, other.y + other.height + 40);
    await app.keyboard.down('Alt');
    await app.waitForTimeout(400);
  }
}
if (STATE === 'drag') {
  // CardA dragged by the pointer and held midway, past CardB (the canonical drag: the insertion line and the ghost)
  const from = await app.locator('.chrome__selection').first().boundingBox();
  if (from !== null) {
    await app.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await app.mouse.down();
    await app.mouse.move(from.x + from.width / 2, from.y + from.height + 60, { steps: 12 });
    await app.waitForTimeout(400);
  }
}
// the pointer rests where it hovers nothing (a menu stays open: the pointer leaving it does not close it)
if (STATE !== 'palette' && STATE !== 'hover' && STATE !== 'drag') await app.mouse.move(1, 899);

type Box = { x: number; y: number; width: number; height: number };
const regions = async (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-region]')].flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > 900) return [];
      const cs = getComputedStyle(el);
      return [{ id: el.getAttribute('data-region') as string, box: { x: r.x, y: r.y, width: r.width, height: r.height }, bg: cs.backgroundColor, color: cs.color, font: `${cs.fontSize} ${cs.fontWeight}` }];
    }),
  );
const a = await regions(canon);
const b = await regions(app);
const lines: string[] = [];
for (const one of a) {
  const other = b.find((x) => x.id === one.id);
  lines.push(`${one.id}\n  canon ${JSON.stringify(one.box)} bg=${one.bg} color=${one.color} font=${one.font}\n  app   ${other ? `${JSON.stringify(other.box)} bg=${other.bg} color=${other.color} font=${other.font}` : 'NOT DRAWN'}`);
  if (!other) continue;
  const clip = (box: Box): Box => ({ x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(1440 - Math.max(0, box.x), box.width), height: Math.min(900 - Math.max(0, box.y), box.height) });
  // the two crops, side by side in name: <state>-<region>-canon.png above <state>-<region>-app.png (joined by
  // tools/parity/join.ts)
  const name = `${STATE}${THEME === 'dark' ? '' : `-${THEME}`}-${one.id.replace(/[:]/g, '_')}`;
  await canon.screenshot({ path: path.join(out, `${name}-canon.png`), clip: clip(one.box) });
  await app.screenshot({ path: path.join(out, `${name}-app.png`), clip: clip(other.box) });
}
for (const one of b) if (!a.some((x) => x.id === one.id)) lines.push(`${one.id}\n  canon NOT DRAWN\n  app   ${JSON.stringify(one.box)}`);
fs.writeFileSync(path.join(out, 'report.txt'), lines.join('\n'));
await canon.screenshot({ path: path.join(out, `${STATE}${THEME === 'dark' ? '' : `-${THEME}`}-whole-canon.png`) });
await app.screenshot({ path: path.join(out, `${STATE}${THEME === 'dark' ? '' : `-${THEME}`}-whole-app.png`) });
console.log(out);
await browser.close();
