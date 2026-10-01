// explorer-assets / explorer-assets-use / export-assets beyond their scenarios (spec/BEHAVIOUR.md#explorer-assets and
// explorer-assets-use.md; the user's real-use audit, item 7.3): the Explorer uploads a file (its Upload button, and an
// image file dropped on the folder), the Source field of an image picks one from the project (the choose button's
// picker, and the field's own suggestions), an image file dropped on the canvas replaces the source of the image under
// the pointer — the acceptance — and the export carries every file at its path. The document is read through the
// read-only test port, the canvas through the frame, the site through the ZIP.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runDoor, runs } from './door.ts';
import { unzip } from '../../tools/runner/unzip.ts';

const INSERT_PANEL = 'workspace.setPanelOpen#toolbar-activity-bar-insert';
const EXPLORER_PANEL = 'workspace.setPanelOpen#toolbar-activity-bar-explorer';
const UPLOAD = 'files.upload#explorer-upload';
const FOLDER_DROP = 'files.upload#panel-drag-os-file-explorer-folder';
const TILE = 'element.insert#elements-tile';
const SETTINGS = 'workspace.setActiveTab#inspector-tab-settings';
const SOURCE = 'element.setAttribute#inspector-src';
const CANVAS_DROP = 'assets.insertImageFile#canvas-drag-os-image-file-drop-proposal';
const PICKER_OPEN = 'assetPicker.open#field-source-choose';
const PICKER_CHOOSE = 'element.setAttribute#asset-picker-choose';
const PICKER_CLOSE = 'assetPicker.close#asset-picker-close';
const EXPORT = 'project.export#toolbar-top-bar-export';

// a real 4x3 PNG, written where Playwright's chooser and the drop read it
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAFElEQVR4nGP8z8Dwn4EIwESMokGtCAAxKQIBlZ8cWQAAAABJRU5ErkJggg==', 'base64');
const shot = '.cache/scratch/assets-shot.png';

interface Node { readonly type: string; readonly attributes: Readonly<Record<string, unknown>>; readonly children: readonly Node[] }
const port = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as { __builderTestPort: { document: () => { files?: readonly { path: string; type: string; width?: number; height?: number }[]; pages: { tree: Node }[] }; selection: () => string[] } }).__builderTestPort;
    return { files: p.document().files ?? [], tree: p.document().pages[0]?.tree, selection: p.selection() };
  });
const imagesOf = (tree: Node | undefined): Node[] => (tree === undefined ? [] : tree.type === 'image' ? [tree] : tree.children.flatMap(imagesOf));

test('typing Grãos de café after a click outside the image picker never runs structure shortcuts', runs(INSERT_PANEL, EXPLORER_PANEL, UPLOAD, TILE, SETTINGS, PICKER_OPEN, PICKER_CHOOSE), async ({ page }) => {
  await openEditorOnInsert(page);
  await upload(page, 'photo.png');
  await runDoor(page, INSERT_PANEL);
  await runDoor(page, TILE, { args: { entry: 'image' } });
  await runDoor(page, SETTINGS);
  await runDoor(page, PICKER_OPEN);
  await runDoor(page, PICKER_CHOOSE, { args: { value: 'img/photo.png' } });
  const before = await port(page);
  // A non-field target keeps this proof independent of whether the picker forwards outside clicks (J8).
  const box = await page.locator('[data-region="status-bar"]').boundingBox();
  if (box === null) throw new Error('The status bar is not visible');
  await page.mouse.click(box.x + 4, box.y + 4);
  // G and R both bind structure commands: check before an unbound letter could cancel a typing sequence.
  await page.keyboard.type('Gr');
  expect(await port(page)).toEqual(before);
  await expect(page.getByRole('status')).toHaveText('Letters typed here do nothing: click the canvas or a Layers row to use their keys, or a field to type into it.');
  await page.keyboard.type('ãos de café');
  expect(await port(page)).toEqual(before);
  await expect(page.getByRole('status')).toHaveText('Letters typed here do nothing: click the canvas or a Layers row to use their keys, or a field to type into it.');
  await expect(page.locator('.frame__page')).toBeVisible();
});

async function openEditorOnInsert(page: Page): Promise<void> {
  await openEditor(page);
  await runDoor(page, INSERT_PANEL);
}

async function upload(page: Page, name: string): Promise<void> {
  await runDoor(page, EXPLORER_PANEL);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, UPLOAD);
  await (await chooser).setFiles({ name, mimeType: 'image/png', buffer: PNG });
}

// a file dragged in from the operating system and released: a real DataTransfer with a real File, as a browser reports
// it — on the frame at the point of the node it is dropped over, or on the Explorer's folder zone
async function dropFile(page: Page, name: string, at: { readonly node: string } | 'folder'): Promise<void> {
  await page.evaluate(
    ({ name, base64, where }) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type: 'image/png' }));
      const fire = (element: Element, x: number, y: number) => {
        for (const type of ['dragenter', 'dragover', 'drop']) element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: x, clientY: y }));
      };
      if (where === 'folder') {
        const zone = document.querySelector('[data-drop-zone="explorer-folder"]');
        if (zone === null) throw new Error('the Explorer folder zone is missing');
        fire(zone, 0, 0);
        return;
      }
      const frame = document.querySelector<HTMLIFrameElement>('.frame__page');
      const doc = frame?.contentDocument;
      if (frame === undefined || frame === null || doc === null || doc === undefined) throw new Error('the canvas frame is missing');
      const target = (where as { readonly node: string }).node;
      const element = doc.querySelector(`[data-node="${target}"]`);
      if (element === null) throw new Error(`the canvas does not draw ${target}`);
      const box = element.getBoundingClientRect();
      fire(element, box.left + box.width / 2, box.top + box.height / 2);
    },
    { name, base64: PNG.toString('base64'), where: at === 'folder' ? 'folder' : { node: at.node } },
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.locator('.workbench')).toBeVisible();
  fs.mkdirSync(path.dirname(shot), { recursive: true });
});

test('the Upload button stores a file the Inspector lists, with its intrinsic size, and a reload keeps it', runs(INSERT_PANEL, EXPLORER_PANEL, UPLOAD), async ({ page }) => {
  await openEditorOnInsert(page);
  await upload(page, 'photo.png');
  await expect.poll(async () => (await port(page)).files).toEqual([{ path: 'img/photo.png', type: 'image/png', bytes: PNG.toString('base64'), width: 4, height: 3 }]);
  // the Explorer lists it, with its path and its size, and a thumbnail of the file itself
  const row = page.locator('[data-region="explorer-file-rows"] [data-file="img/photo.png"]');
  await expect(row).toHaveCount(1);
  await expect(row.locator('.row__name')).toHaveText('photo.png');
  await expect(row.locator('.row__meta')).toContainText('img/');
  const thumb = await row.locator('img.row__thumb').evaluate((img) => ({ src: (img as HTMLImageElement).src.slice(0, 5), w: (img as HTMLImageElement).naturalWidth }));
  expect(thumb).toEqual({ src: 'blob:', w: 4 });
  await page.screenshot({ path: shot });
  // a reload keeps the file: it is part of the saved project
  await page.reload();
  await expect(page.locator('.workbench')).toBeVisible();
  await expect.poll(async () => (await port(page)).files.map((f) => f.path)).toEqual(['img/photo.png']);
  await expect(page.locator('[data-region="explorer-file-rows"] [data-file="img/photo.png"]')).toHaveCount(1);
});

test('an image file dropped on the folder uploads; moved files do not overwrite each other', runs(EXPLORER_PANEL, FOLDER_DROP), async ({ page }) => {
  await openEditorOnInsert(page);
  await upload(page, 'photo.png');
  await dropFile(page, 'photo.png', 'folder');
  await expect.poll(async () => (await port(page)).files.map((f) => f.path)).toEqual(['img/photo.png', 'img/photo-2.png']);
});

test('an image file dropped on an image replaces its source, and the export carries the file', runs(INSERT_PANEL, EXPLORER_PANEL, TILE, CANVAS_DROP, EXPORT), async ({ page }) => {
  await openEditorOnInsert(page);
  await runDoor(page, TILE, { args: { entry: 'image' } });
  await upload(page, 'photo.png');
  const [image] = imagesOf((await port(page)).tree);
  if (image === undefined) throw new Error('the Image was not inserted');
  // the acceptance of item 7.3: dropping a PNG of the computer on the image changes its source
  await dropFile(page, 'photo.png', { node: (await port(page)).selection[0] ?? '' });
  await expect.poll(async () => imagesOf((await port(page)).tree)[0]?.attributes.src).toBe('img/photo-2.png');
  // the canvas draws the file itself (an object URL of the stored bytes, 4x3 as the file is)
  await expect.poll(async () => page.frameLocator('.frame__page').locator('img').evaluate((img) => ({ w: (img as HTMLImageElement).naturalWidth, src: (img as HTMLImageElement).src.slice(0, 5) }))).toEqual({ w: 4, src: 'blob:' });
  await page.screenshot({ path: shot });
  // the export carries both files at their paths, and the page points at the one it uses
  const download = page.waitForEvent('download');
  await runDoor(page, EXPORT);
  const files = unzip(fs.readFileSync(await (await download).path()));
  expect([...files.keys()].sort()).toEqual(['css/styles.css', 'img/photo-2.png', 'img/photo.png', 'index.html']);
  expect(files.get('index.html')?.toString('utf8')).toContain('<img src="img/photo-2.png"');
  expect(files.get('img/photo-2.png')?.toString('utf8')).toContain('PNG');
});

test('the Source field chooses a project file from its picker, and Escape or the close button leaves the picker', runs(INSERT_PANEL, EXPLORER_PANEL, UPLOAD, TILE, SETTINGS, PICKER_OPEN, PICKER_CHOOSE, PICKER_CLOSE), async ({ page }) => {
  await openEditorOnInsert(page);
  await upload(page, 'photo.png');
  await runDoor(page, INSERT_PANEL);
  await runDoor(page, TILE, { args: { entry: 'image' } });
  await runDoor(page, SETTINGS);
  // the field suggests the project's images, the media library of the Explorer being the other way to see them
  const field = control(page, SOURCE).locator('input.input');
  const listId = await field.getAttribute('list');
  expect(listId, 'the Source field suggests the project images').not.toBeNull();
  expect(await page.locator(`datalist#${String(listId)} option`).evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value))).toEqual(['img/photo.png']);
  // the choose button opens the picker: an item writes the source, one undo step
  await runDoor(page, PICKER_OPEN);
  const picker = page.locator('[data-region="asset-picker"]');
  await expect(picker).toBeVisible();
  await page.screenshot({ path: shot });
  await runDoor(page, PICKER_CHOOSE, { args: { value: 'img/photo.png' } });
  await expect.poll(async () => imagesOf((await port(page)).tree)[0]?.attributes.src).toBe('img/photo.png');
  // Choosing completes the interaction and returns focus; Escape still closes a fresh opening.
  await expect(picker).toHaveCount(0);
  await expect(control(page, PICKER_OPEN)).toBeFocused();
  await runDoor(page, PICKER_OPEN);
  // Escape closes it (the picker's own key context), and the close button does too
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await runDoor(page, PICKER_OPEN);
  await expect(picker).toBeVisible();
  await runDoor(page, PICKER_CLOSE);
  await expect(picker).toHaveCount(0);
  expect((await port(page)).files.map((f) => f.path)).toEqual(['img/photo.png']);
});

test('one outside click closes the image picker and types into Alt', runs(INSERT_PANEL, TILE, SETTINGS, PICKER_OPEN), async ({ page }) => {
  await openEditorOnInsert(page);
  await runDoor(page, TILE, { args: { entry: 'image' } });
  await runDoor(page, SETTINGS);
  await runDoor(page, PICKER_OPEN);
  const alt = control(page, 'element.setAttribute#inspector-alt').locator('input');
  const box = await alt.boundingBox();
  if (!box) throw new Error('Alt is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(alt).toBeFocused();
  await expect(page.locator('[data-region="asset-picker"]')).toHaveCount(0);
  await page.keyboard.type('Grãos de café');
  await page.keyboard.press('Enter');
  await expect.poll(async () => imagesOf((await port(page)).tree)[0]?.attributes.alt).toBe('Grãos de café');
});
