// The Explorer's file tree (manifest feature explorer-file-system; spec explorer-file-system): a folder and a file are
// made by typing their paths, a file is renamed through its row's name field, moved into a folder through the row's
// Move to… entries, and deleted (a folder that holds files asks first, dialog.deleteFiles). The document JSON is the
// source of truth: every step is read back through the read-only test port, and one undo takes each back. The paths the
// document generates (css/styles.css, js/interactions.js) and the folders that hold them are refused everywhere.
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, runs, openExplorer } from './door.ts';

const NEW_FILE = 'files.createFile#explorer-new-file';
const NEW_FOLDER = 'files.createFolder#explorer-new-folder';
const NAME_FIELD = 'files.rename#explorer-file-name-field';
const RENAME = 'files.startRename#explorer-file-name';
const MOVE_TO = 'files.move#explorer-move-to';
const MOVE_TARGET = 'files.move#explorer-move-target';
const DELETE = 'files.delete#explorer-delete';

const tree = (page: Page): Promise<{ files: readonly string[]; folders: readonly string[] }> =>
  page.evaluate(() => {
    const d = (window as unknown as { __builderTestPort: { document: () => { files?: { path: string }[]; folders?: string[] } } }).__builderTestPort.document();
    return { files: (d.files ?? []).map((f) => f.path), folders: d.folders ?? [] };
  });

// the keys of the app (undo, redo) act once no field holds the focus: a field keeps Ctrl+Z for its own text
async function appKey(page: Page, chord: string): Promise<void> {
  await page.locator('.section-title__text').first().click();
  await page.keyboard.press(chord);
}

// a path typed into one of the tree's two create fields, kept with Enter
async function make(page: Page, door: string, path: string): Promise<void> {
  // the control IS the field: the create doors are drawn as the inputs their paths are typed into
  const field = page.locator(`[data-door="${door}"]`);
  await field.click();
  await field.fill(path);
  await field.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await openExplorer(page);
});

// The scenario runner covers the doors' arguments; what this proves is the tree the document ends up holding, which a
// proxy (a row, a size) would not.
test('the tree makes, renames, moves and deletes a folder and a file, one undo each', runs(NEW_FILE, NEW_FOLDER, NAME_FIELD, RENAME, MOVE_TO, MOVE_TARGET, DELETE), async ({ page }) => {
  await make(page, NEW_FOLDER, 'js');
  await expect.poll(async () => (await tree(page)).folders, { message: 'the folder is in the document' }).toEqual(['js']);
  await make(page, NEW_FILE, 'js/main.js');
  await expect.poll(async () => (await tree(page)).files, { message: 'the file is in the document, at its path' }).toEqual(['js/main.js']);
  await expect(page.getByRole('status')).toHaveText('File main.js made.');
  await control(page, 'selection.select#layers-row').first().waitFor().catch(() => undefined);
  // one undo takes the file back, and one more the folder
  await appKey(page, 'Control+Z');
  await expect.poll(async () => (await tree(page)).files).toEqual([]);
  await appKey(page, 'Control+Z');
  await expect.poll(async () => (await tree(page)).folders).toEqual([]);
  await appKey(page, 'Control+Shift+Z');
  await appKey(page, 'Control+Shift+Z');
  await expect.poll(async () => (await tree(page)).files).toEqual(['js/main.js']);

  // the row's name field renames it where it stands
  const row = page.locator('[data-file="js/main.js"]');
  await row.hover();
  await row.locator('[data-door="files.startRename#explorer-file-name"]').click();
  const field = row.locator(`[data-door="${NAME_FIELD}"]`);
  await expect(field, 'the pencil opens the name field').toBeVisible();
  await field.fill('app.js');
  await field.press('Enter');
  await expect.poll(async () => (await tree(page)).files, { message: 'the name field renames the file' }).toEqual(['js/app.js']);
  await expect(page.getByRole('status')).toHaveText('Renamed to app.js.');

  // Move to… lists the folders, and the entry moves the file into one
  await make(page, NEW_FOLDER, 'src');
  await page.locator('[data-file="js/app.js"]').hover();
  // the button stands for the folder the row is already in (its press changes nothing and opens the entries)
  await control(page, MOVE_TO, { args: { path: 'js/app.js', to: 'js' } }).click();
  const target = control(page, MOVE_TARGET, { args: { path: 'js/app.js', to: 'src' } });
  await expect(target, 'the folders it may move into are offered').toBeVisible();
  await target.click();
  await expect.poll(async () => (await tree(page)).files, { message: 'the file moves into the folder it was sent to' }).toEqual(['src/app.js']);
  await expect(page.getByRole('status')).toHaveText('Moved app.js into src.');

  // deleting the folder takes what it holds, after the confirmation
  await page.locator('[data-file="src"] [data-door="' + DELETE + '"]').click();
  const dialog = page.locator('[data-confirmation-dialog]');
  await expect(dialog, 'a folder that holds files asks first').toBeVisible();
  await dialog.locator('[data-confirmation="confirm"]').click();
  await expect.poll(async () => await tree(page), { message: 'the folder and its file are gone' }).toEqual({ files: [], folders: ['js'] });
  await appKey(page, 'Control+Z');
  await expect.poll(async () => (await tree(page)).files, { message: 'one undo gives the whole folder back' }).toEqual(['src/app.js']);
});

test('the paths the document generates are refused, and so is a folder that holds one', runs(NEW_FILE, NEW_FOLDER, DELETE, 'files.rename#explorer-file-name-field'), async ({ page }) => {
  // a file may not take a generated path
  await make(page, NEW_FILE, 'css/styles.css');
  await expect(page.getByRole('status')).toHaveText('css/styles.css is generated from the document and keeps its path.');
  expect((await tree(page)).files, 'nothing was made').toEqual([]);
  // the folder css exists (the stylesheet stands in it) and may not be deleted
  await page.locator('[data-file="css"] [data-door="' + DELETE + '"]').click();
  await expect(page.getByRole('status')).toHaveText('css is generated from the document and keeps its path.');
  expect(await tree(page), 'the refusal writes nothing').toEqual({ files: [], folders: [] });
  await expect(page.locator('[data-file="css"]'), 'the folder the generated file stands in is still drawn').toHaveCount(1);
  // and it is not listed among the folders a file may move into
  await make(page, NEW_FILE, 'note.txt');
  await page.locator('[data-file="note.txt"]').hover();
  await control(page, MOVE_TO, { args: { path: 'note.txt', to: '' } }).click();
  await expect(control(page, MOVE_TARGET, { args: { path: 'note.txt', to: 'css' } }), 'a folder the document generates a file in is still a folder').toHaveCount(1);
});

// A file row says what the file is (spec explorer-file-system, Problems in Pager 5): a code file its kind as a tag, a
// file the editor writes a "generated" pill that says why it cannot be deleted, every name in the mono type.
test('a code file shows its kind as a tag, and a file the editor writes says it is generated', runs(NEW_FILE), async ({ page }) => {
  await make(page, NEW_FILE, 'main.js');
  const pageRow = page.locator('[data-region="explorer-file-rows"] .row[data-file="index.html"]');
  await expect(pageRow.locator('.ftag')).toHaveText('HTML');
  await expect(pageRow.locator('.row__gen')).toHaveText('generated');
  await expect(pageRow.locator('.row__gen')).toHaveAttribute('title', /cannot be deleted/);
  const own = page.locator('[data-region="explorer-file-rows"] .row[data-file="main.js"]');
  await expect(own.locator('.ftag')).toHaveText('JS');
  await expect(own.locator('.row__gen')).toHaveCount(0);
  expect(await own.locator('.row__name').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Cascadia|Consolas|monospace/);
});

// A click on another page's name opens that page; only the page on the canvas is renamed in place (spec explorer-pages,
// Problems in Pager 2; the dogfooding pass).
test('a click on another page name opens it, and only the shown page is renamed in place', runs('pages.add#explorer-add-page', 'pages.switch#explorer-page-row'), async ({ page }) => {
  await control(page, 'pages.add#explorer-add-page').click();
  const names = page.locator('.row--page .row__name-field');
  await expect(names).toHaveCount(2);
  await expect(names.nth(0)).toHaveAttribute('readonly', '');
  await names.nth(0).click();
  await expect(page.locator('.top-bar__page b')).toHaveText('Home');
  await expect(names.nth(0)).not.toBeFocused();
  await expect(names.nth(0)).not.toHaveAttribute('readonly', '');
  await expect(names.nth(1)).toHaveAttribute('readonly', '');
});
