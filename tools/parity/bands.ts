// A photo of Edit on canvas's Padding mode on the aurora Hero, beside the canonical selection state's bands (the
// pairing, tools/parity/pair.ts): node tools/parity/bands.ts. Writes .cache/logs/parity-bands-app.png.
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const APP = `http://localhost:${process.env.PORT ?? '5320'}/`;
const browser = await chromium.launch({ channel: 'chrome' });
const app = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
await app.goto(APP);
await app.waitForTimeout(1200);
await app.locator('[data-menu="file"]').click();
const chooser = app.waitForEvent('filechooser');
await app.locator('[data-door="project.open#menu-file"]').click();
await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync('manifest/features/fixtures/aurora.json') });
await app.waitForTimeout(1500);
await app.locator('[data-door="selection.select#layers-row"]', { hasText: 'Hero' }).first().click();
await app.waitForTimeout(400);
await app.keyboard.press('Control+Shift+Q');
await app.waitForTimeout(400);
await app.locator('[data-door="canvas.setEditMode#quick-panel-edit-on-canvas"]').click();
await app.locator('[role="option"]', { hasText: 'Padding' }).first().click();
await app.waitForTimeout(400);
await app.keyboard.press('Control+Shift+Q');
await app.waitForTimeout(400);
const frame = await app.locator('[data-region="canvas-frame"]').boundingBox();
if (frame) await app.screenshot({ path: '.cache/logs/parity-bands-app.png', clip: { x: frame.x, y: frame.y, width: Math.min(700, frame.width), height: 320 } });
await browser.close();
