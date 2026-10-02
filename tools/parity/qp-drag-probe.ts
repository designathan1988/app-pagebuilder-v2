// A probe of the quick panel's grip drag (tests/e2e/quick-panel.spec.ts, the offset kept after a reload): the stage,
// the element and the panel before and after the 120 / -60 drag. node tools/parity/qp-drag-probe.ts
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
await page.goto(`http://localhost:${process.env.PORT ?? '5320'}/`);
await page.waitForTimeout(1200);
await page.locator('[data-menu="file"]').click();
const chooser = page.waitForEvent('filechooser');
await page.locator('[data-door="project.open#menu-file"]').click();
await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync('manifest/features/fixtures/aurora.json') });
await page.waitForTimeout(1500);
await page.locator('[data-door="selection.select#layers-row"][data-args*="n-intro"]').first().click();
await page.locator('[data-quick-panel-chip][aria-expanded="false"]').click();
await page.waitForTimeout(400);
const boxes = () => page.evaluate(() => {
  const r = (el: Element | null | undefined) => (el ? (({ x, y, width, height }) => ({ x, y, width, height }))(el.getBoundingClientRect()) : null);
  const iframe = document.querySelector<HTMLIFrameElement>('.frame__page');
  const el = iframe?.contentDocument?.querySelector('[data-node="n-intro"]');
  const frame = iframe?.getBoundingClientRect();
  const zoom = iframe ? parseFloat(getComputedStyle(iframe).zoom) || 1 : 1;
  const e = el?.getBoundingClientRect();
  return { stage: r(document.querySelector('.stage')), panel: r(document.querySelector('.quick-panel')), element: e && frame ? { x: frame.x + e.x * zoom, y: frame.y + e.y * zoom } : null, zoom, offset: document.querySelector('[data-offset]')?.getAttribute('data-offset') };
});
console.log('before', JSON.stringify(await boxes()));
const grip = await page.locator('[data-door="quickPanel.setOffset#panel-drag-quick-panel-grip-canvas"]').boundingBox();
if (grip) {
  const from = { x: Math.round(grip.x + grip.width / 2), y: Math.round(grip.y + grip.height / 2) };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y - 60, { steps: 10 });
  await page.mouse.up();
}
await page.waitForTimeout(300);
console.log('after ', JSON.stringify(await boxes()));
await browser.close();
