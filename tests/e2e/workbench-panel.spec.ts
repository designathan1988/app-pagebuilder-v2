// workbench-panel beyond its scenarios (spec/BEHAVIOUR.md#workbench-panel, Problems in Pager 2): View › Developer tools
// gives the dock a Document tab showing the document as it is now, as JSON, read-only, drawn again after every command;
// the choice is a preference, so the tab is there again after a reload, and turning it off takes the tab out. The
// document is read through the read-only test port.
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';

const DEVELOPER = 'workspace.toggleDeveloperTools#menu-view';
const INSERT_PANEL = 'workspace.setPanelOpen#toolbar-activity-bar-insert';
const TILE = 'element.insert#elements-tile';

const portDocument = (page: Page) => page.evaluate(() => (window as unknown as Record<string, { document: () => unknown }>).__builderTestPort?.document());
const shownJson = async (page: Page): Promise<unknown> => JSON.parse((await page.locator('.dock [role="tabpanel"]').locator('pre').textContent()) ?? 'null');
const tabs = (page: Page) => page.locator('[data-region="tab-strip"] [role="tab"]').evaluateAll((els) => els.map((el) => el.textContent));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await expect(page.locator('.workbench')).toBeVisible();
});

test('the Document tab shows the live document as JSON, read-only, drawn again after every command', runs(DEVELOPER, INSERT_PANEL, TILE), async ({ page }) => {
  await runDoor(page, DEVELOPER);
  await expect(page.locator('.dock [role="tabpanel"]')).toHaveAttribute('aria-label', 'Document');
  const before = await portDocument(page);
  expect(await shownJson(page)).toEqual(before);

  // a command that changes the document: the tab shows the new document, not the old one
  await runDoor(page, INSERT_PANEL);
  await control(page, TILE, { args: { entry: 'paragraph' } }).click();
  const after = await portDocument(page);
  expect(after).not.toEqual(before);
  await expect.poll(() => shownJson(page)).toEqual(after);

  // read-only: typing into it changes neither what it shows nor the document
  const pre = page.locator('.dock [role="tabpanel"]').locator('pre');
  await pre.click();
  await page.keyboard.type('x');
  expect(await shownJson(page)).toEqual(after);
  expect(await portDocument(page)).toEqual(after);
  expect(await pre.evaluate((el) => (el as HTMLElement).isContentEditable)).toBe(false);
});

test('Developer tools is kept after a reload with its Document tab; turned off, the tab goes', runs(DEVELOPER), async ({ page }) => {
  // a fresh profile keeps the dock closed, drawing only its strip (DEC-02, which revoked A3.18's no strip), so it is
  // opened first
  await runDoor(page, 'workspace.setPanelOpen#menu-view-workbench');
  expect(await tabs(page)).toEqual(['Timeline', 'Checks']);
  await runDoor(page, DEVELOPER);
  expect(await tabs(page)).toEqual(['Timeline', 'Checks', 'Document']);
  await page.reload();
  await expect(page.locator('.workbench')).toBeVisible();
  expect(await tabs(page)).toEqual(['Timeline', 'Checks', 'Document']);
  await runDoor(page, DEVELOPER);
  expect(await tabs(page)).toEqual(['Timeline', 'Checks']);
  await page.reload();
  await expect(page.locator('.workbench')).toBeVisible();
  expect(await tabs(page)).toEqual(['Timeline', 'Checks']);
});

// A file's bytes do not make one line of the whole file (spec workbench-panel, Problems in Pager 4; the audit's U-027):
// a string longer than 200 characters shows its start and its length, and the document keeps every byte.
test('the Document tab shows a long string as its start and its length', runs(DEVELOPER, 'project.open#menu-file'), async ({ page }) => {
  const bytes = 'A'.repeat(5000);
  const project = { version: 1, pages: [{ id: 'p', name: 'Home', file: 'index.html', tree: { id: 'n-page', type: 'page', name: 'Page', tag: 'body', attributes: {}, classes: [], styles: {}, text: null, children: [] } }], files: [{ path: 'notes.txt', type: 'text/plain', bytes }] };
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, 'project.open#menu-file');
  await (await chooser).setFiles({ name: 'long.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect.poll(async () => ((await portDocument(page)) as { files?: { bytes: string }[] }).files?.[0]?.bytes.length ?? 0).toBe(5000);
  await runDoor(page, DEVELOPER);
  const pre = page.locator('.dock [role="tabpanel"]').locator('pre');
  await expect(pre).toContainText(`"${'A'.repeat(48)}… (5000 characters)"`);
  expect(await pre.evaluate((el) => el.scrollWidth)).toBeLessThan(2000);
});
