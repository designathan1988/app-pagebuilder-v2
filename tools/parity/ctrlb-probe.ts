// A probe of Ctrl+B with the focus in the Insert panel's search field (tests/e2e/activity-open.spec.ts, the last
// steps): node tools/parity/ctrlb-probe.ts
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
await page.goto(`http://localhost:${process.env.PORT ?? '5320'}/`);
await page.waitForTimeout(1500);
await page.locator('[data-door="workspace.setPanelOpen#toolbar-activity-bar-insert"]').click();
await page.waitForTimeout(500);
console.log('focus', await page.evaluate(() => {
  const el = document.activeElement;
  return el ? `${el.tagName}.${el.className} ctx=${el.getAttribute('data-key-context')}` : 'none';
}));
await page.keyboard.press('Control+b');
await page.waitForTimeout(300);
console.log('sidebar after Ctrl+B', await page.locator('.sidebar').count());
await browser.close();
