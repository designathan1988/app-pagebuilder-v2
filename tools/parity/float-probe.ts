// A probe of a floating panel's header (tests/e2e/panels-windows.spec.ts): what stands at the centre of the header's
// drag band once Layers floats. node tools/parity/float-probe.ts
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
await page.goto(`http://localhost:${process.env.PORT ?? '5320'}/`);
await page.waitForTimeout(1500);
const band = (ref: string) => page.locator(`[data-door="${ref}"][data-args*='"panel":"layers"']`).first();
const start = await band('workspace.movePanel#panel-drag-panel-header-canvas').boundingBox();
if (start === null) throw new Error('no header band');
await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
await page.mouse.down();
await page.mouse.move(900, 400, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(400);
const again = await band('workspace.movePanel#panel-drag-floating-header-anywhere').boundingBox();
console.log('band', JSON.stringify(again));
if (again) {
  const x = again.x + again.width / 2;
  const y = again.y + again.height / 2;
  console.log('at centre', await page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    return el ? `${el.tagName}.${el.className} door=${el.closest('[data-door]')?.getAttribute('data-door')}` : 'none';
  }, [x, y] as const));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(1200, 700, { steps: 12 });
  console.log('during', await page.evaluate(() => document.querySelector('[data-panel-window="layers"]')?.getBoundingClientRect().toJSON() ?? 'gone'));
  await page.mouse.up();
  await page.waitForTimeout(400);
  console.log('after', await page.evaluate(() => document.querySelector('[data-panel-window="layers"]')?.getBoundingClientRect().toJSON() ?? 'gone'), await page.evaluate(() => document.querySelector('[role="status"]')?.textContent));
  console.log('header', await page.locator('[data-panel-window="layers"] [data-panel-header]').first().evaluate((el) => el.outerHTML.slice(0, 1500)));
}
await browser.close();
