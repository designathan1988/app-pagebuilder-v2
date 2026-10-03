// explorer-pages beyond its scenarios (spec/BEHAVIOUR.md#explorer-pages, Problems 3): the + of the Pages list gives
// the new page's name field the focus with its name selected, so a person types the name and Enter keeps it, its file
// following; a second + then a second name make a second page. The document is read through the read-only test port.
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { runDoor, runs, openExplorer } from './door.ts';

const ADD = 'pages.add#explorer-add-page';
const NAME = 'pages.rename#explorer-page-name-field';

const pages = (page: Page) =>
  page.evaluate(() => (window as unknown as { __builderTestPort: { document: () => { pages: { name: string; file: string }[] } } }).__builderTestPort.document().pages.map((p) => `${p.name} ${p.file}`));

test('after the + the new page takes the name typed, and Enter keeps it with its file', runs(ADD, NAME), async ({ page }) => {
  await openEditor(page);
  await openExplorer(page);
  await runDoor(page, ADD);
  const focused = page.locator(':focus');
  await expect(focused).toHaveAttribute('data-door', NAME);
  await expect(focused).toHaveValue('Page');
  expect(await focused.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 4]);
  await page.keyboard.type('Sobre');
  await page.keyboard.press('Enter');
  await expect.poll(() => pages(page)).toEqual(['Home index.html', 'Sobre sobre.html']);
  await runDoor(page, ADD);
  await page.keyboard.type('Contato');
  await page.keyboard.press('Enter');
  await expect.poll(() => pages(page)).toEqual(['Home index.html', 'Sobre sobre.html', 'Contato contato.html']);
});
