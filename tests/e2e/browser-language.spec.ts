// The editor opens in the browser's language when the person chose none (jornada03 J26): a Portuguese Chrome shows a
// Portuguese editor and a Portuguese empty project, and the person's choice wins after a reload.
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { openMenu, runs } from './door.ts';

test.use({ locale: 'pt-BR' });

test('a Portuguese browser opens a Portuguese editor, and a chosen language stays chosen', runs('preferences.setLanguage#menu-language-en'), async ({ page }) => {
  await openEditor(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('[data-menu="file"]')).toHaveText('Arquivo');
  await openMenu(page, 'view');
  await page.getByRole('menuitem', { name: 'Idioma', exact: true }).hover();
  await page.locator('[data-door="preferences.setLanguage#menu-language-en"]').click();
  await expect(page.locator('[data-menu="file"]')).toHaveText('File');
  await page.reload();
  await expect(page.locator('[data-menu="file"]')).toHaveText('File');
});
