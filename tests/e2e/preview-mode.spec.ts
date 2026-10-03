// preview-mode beyond its scenarios (spec/BEHAVIOUR.md#preview-mode): the preview is the exported page run as a browser
// runs it: a hover value applies when the pointer is over the element, links open in a new tab (never the editor),
// no editor chrome is left over it, and the preview changes nothing in the document.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';

const FIXTURE = 'manifest/features/fixtures/aurora.json';
const OPEN = 'project.open#menu-file';
const ROW = 'selection.select#layers-row';
const HOVER = 'view.setStyleState#menu-style-state-hover';
const BASE = 'view.setStyleState#menu-style-state-base';
const COLOR = 'style.set#inspector-color';
const PREVIEW = 'view.enterPreview#key-ctrl-p-in-global';
const EXIT = 'view.exitPreview#key-escape-in-preview';
type Port = { document: () => unknown };
const documentNow = (page: Page) => page.evaluate(() => JSON.stringify((window as unknown as { __builderTestPort: Port }).__builderTestPort.document()));

test('the preview runs the exported page: hover applies, links open in a new tab, the document stays as it was', runs(OPEN, ROW, HOVER, BASE, COLOR, PREVIEW, EXIT), async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await control(page, ROW, { args: { target: 'n-intro' } }).click();
  await runDoor(page, HOVER);
  const field = control(page, COLOR).locator('input').first();
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('#aa0000\n');
  await runDoor(page, BASE);
  const before = await documentNow(page);

  await runDoor(page, PREVIEW);
  const preview = page.frameLocator('[data-region="preview-page"]');
  const intro = preview.locator('p').first();
  // no editor chrome over the page: the canvas's selection outline is not reachable where the page is
  await expect(page.locator('[data-region="preview-page"]')).toBeVisible();
  const box = await page.locator('[data-region="preview-page"]').boundingBox();
  if (box === null) throw new Error('the preview is not laid out');
  const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.getAttribute('data-region') ?? null, [box.x + 20, box.y + 20]);
  expect(onTop).toBe('preview-page');
  const resting = await intro.evaluate((el) => getComputedStyle(el).color);
  expect(resting).not.toBe('rgb(170, 0, 0)');
  await intro.hover();
  await expect.poll(() => intro.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(170, 0, 0)');
  // a link of the page opens in a new tab, never in the editor
  expect(await preview.locator('base').getAttribute('target')).toBe('_blank');

  await runDoor(page, EXIT);
  await expect(page.locator('[data-region="preview-page"]')).toHaveCount(0);
  expect(await documentNow(page)).toBe(before);
});

test('Escape leaves the preview after a click inside its page', runs(OPEN, PREVIEW, EXIT), async ({ page }) => {
  // the dogfooding pass: the page runs sandboxed in its own origin, so once a visitor clicked in it Escape was heard by
  // the page alone and the preview never ended
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  // the project opened (the canvas draws its Title) before the document is read
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-title"]')).toHaveCount(1);
  const before = await documentNow(page);
  await page.keyboard.press('Control+P');
  const frame = page.locator('[data-region="preview-page"]');
  await expect(frame).toBeVisible();
  await page.frameLocator('[data-region="preview-page"]').locator('h1').click();
  await page.keyboard.press('Escape');
  await expect(frame).toHaveCount(0);
  await expect(page.locator('.workbench')).toBeVisible();
  // the editor has its keys back and the click in the page changed nothing (the audit's AUD-35: the frame gone alone
  // left the focus unproven): its own shortcut opens the preview again
  expect(await documentNow(page)).toBe(before);
  await page.keyboard.press('Control+P');
  await expect(frame).toBeVisible();
});

test('only the previewed page relays a key: another sandboxed frame is not heard', runs(OPEN, PREVIEW), async ({ page }) => {
  // the audit's AUD-10: the relay took any message from an opaque origin, so an embed sandboxed inside the page (or any
  // other sandboxed frame) could end the preview; only the preview frame's own window is heard (MDN, postMessage: check
  // the sender, opaque origins all read "null")
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync(FIXTURE) });
  await page.keyboard.press('Control+P');
  const frame = page.locator('[data-region="preview-page"]');
  await expect(frame).toBeVisible();
  // the editor hears each message after the relay did (its listener came first), so the relay has answered when it resolves
  const heard = (marker: string) =>
    page.evaluate((m) => new Promise<void>((resolve) => addEventListener('message', (e) => (e.data as { marker?: string } | null)?.marker === m && resolve())), marker);
  const sibling = heard('sibling');
  await page.evaluate(() => {
    const rogue = document.createElement('iframe');
    rogue.setAttribute('sandbox', 'allow-scripts');
    rogue.srcdoc = `<script>parent.postMessage({ marker: 'sibling', builderPreviewKey: { key: 'Escape', code: 'Escape' } }, '*')</script>`;
    document.body.append(rogue);
  });
  await sibling;
  await expect(frame).toBeVisible();
  const nested = heard('nested');
  await page.frameLocator('[data-region="preview-page"]').locator('body').evaluate(() => {
    const embed = document.createElement('iframe');
    embed.setAttribute('sandbox', 'allow-scripts');
    embed.srcdoc = `<script>top.postMessage({ marker: 'nested', builderPreviewKey: { key: 'Escape', code: 'Escape' } }, '*')</script>`;
    document.body.append(embed);
  });
  await nested;
  await expect(frame).toBeVisible();
  // the page's own relay still works
  await page.frameLocator('[data-region="preview-page"]').locator('h1').click();
  await page.keyboard.press('Escape');
  await expect(frame).toHaveCount(0);
});
