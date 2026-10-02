// A probe of the status bar's fixed items before and after a long refusal (tests/e2e/status-bar-messages.spec.ts):
// node tools/parity/status-probe.ts
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
await page.locator('[data-door="selection.select#layers-row"][data-args*="n-grid"]').first().click();
const items = () => page.locator('.status-bar > :not(.status-bar__message, .status-bar__breadcrumb)').evaluateAll((els) => els.map((el) => `${el.className}|${(el.textContent ?? '').trim()}|${Math.round(el.getBoundingClientRect().x)}+${Math.round(el.getBoundingClientRect().width)}`));
console.log('before', JSON.stringify(await items(), null, 1));
await page.locator('[data-door="style.set#inspector-width"] input').first().click();
await page.keyboard.press('Control+A');
await page.keyboard.type('w'.repeat(300));
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
console.log('after', JSON.stringify(await items(), null, 1));
await browser.close();
