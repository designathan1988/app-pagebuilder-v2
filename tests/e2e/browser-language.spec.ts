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

// The audit's AUD-21 (jornada03 J26, the rest of it): a fresh editor opened on the Explorer, and called its insert panel
// "Elements" in the View menu and its doors. A fresh profile opens on Insert, named Insert everywhere.
test('a fresh editor opens on the Insert panel, which the View menu names Insert', runs('workspace.setPanelOpen#menu-view-elements'), async ({ page }) => {
  await openEditor(page);
  await expect(page.locator('.sidebar__view[data-panel-area="elements"]'), 'the first panel is Insert').toBeVisible();
  await expect(page.locator('.sidebar__view[data-panel-area="explorer"]')).toHaveCount(0);
  await expect(page.locator('[data-door="workspace.setPanelOpen#toolbar-activity-bar-insert"]')).toHaveAttribute('aria-pressed', 'true');
  await openMenu(page, 'view');
  await expect(page.locator('[data-door="workspace.setPanelOpen#menu-view-elements"]')).toContainText('Inserir');
});
