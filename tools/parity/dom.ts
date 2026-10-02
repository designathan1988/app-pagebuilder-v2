// The DOM of one region of the app in the breakpoint state, for the pairing (tools/parity/pair.ts): node tools/parity/dom.ts
// <css selector> [state]. Prints the selector's outer HTML and each element's box and colours.
import { chromium } from '@playwright/test';

const SELECTOR = process.argv[2] ?? '.quick-panel';
const STATE = process.argv[3] ?? 'breakpoint';
const APP = `http://localhost:${process.env.PORT ?? '5320'}/`;
const browser = await chromium.launch({ channel: 'chrome' });
const app = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
await app.goto(APP);
await app.waitForTimeout(1200);
await app.locator('[data-menu="file"]').click();
const chooser = app.waitForEvent('filechooser');
await app.locator('[data-door="project.open#menu-file"]').click();
await (await chooser).setFiles('manifest/features/fixtures/cards-class.json');
await app.waitForTimeout(1500);
await app.locator('.workbench').waitFor();
await app.locator('[data-door="selection.select#layers-row"]', { hasText: 'CardA' }).first().click();
await app.waitForTimeout(500);
if (STATE === 'breakpoint') {
  await app.locator('[data-door="view.setBreakpoint#toolbar-breakpoint-tabs-tablet"]').click();
  await app.waitForTimeout(500);
  await app.keyboard.press('Control+Shift+Q');
  await app.waitForTimeout(600);
}
// with EVAL set, that expression's value in the page (the element is \`el\`)
if (process.env.EVAL) console.log(await app.evaluate(([sel, code]) => new Function('el', `return ${code}`)(document.querySelector(sel)), [SELECTOR, process.env.EVAL] as const));
// with MEASURE set, each child's class and width instead of the HTML
if (process.env.MEASURE) console.log(await app.evaluate((sel) => [...(document.querySelector(sel)?.querySelectorAll('*') ?? [])].map((el) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`).join(String.fromCharCode(10)), SELECTOR));
else console.log(await app.evaluate((sel) => document.querySelector(sel)?.outerHTML ?? 'NONE', SELECTOR));
await browser.close();
