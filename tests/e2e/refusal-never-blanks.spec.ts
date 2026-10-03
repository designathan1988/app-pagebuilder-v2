// The audit's AUD-01 path, which blanked the whole editor: on aurora, a link inserted after the Intro, State › Visited
// chosen for it, the Title selected, 40 typed in its font size. The style state now goes back to Base when the Title is
// selected (AUD-03, the user's decision) and says so; the font size is written on the Title's base layer; the editor
// stays drawn, region by region; and nothing reaches the incident feed (the fixture of every test reads it).
import fs from 'node:fs';
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { control, ensurePanel, runDoor, runs } from './door.ts';

const OPEN = 'project.open#menu-file';
const SELECT = 'selection.select#layers-row';
const INSERT = 'workspace.setPanelOpen#toolbar-activity-bar-insert';
const TILE = 'element.insert#elements-tile';
const VISITED = 'view.setStyleState#menu-style-state-visited';
const FONT_SIZE = 'style.set#inspector-font-size';

type Port = { document: () => { pages: { tree: Node }[] }; selection: () => readonly string[] };
interface Node { readonly id: string; readonly styles: Record<string, Record<string, Record<string, string>> | undefined>; readonly children: readonly Node[] }
const titleStyles = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const port = (window as unknown as { __builderTestPort: Port }).__builderTestPort;
    const find = (node: Node): Node | null => (node.id === 'n-title' ? node : node.children.map(find).find((n) => n !== null) ?? null);
    return find(port.document().pages[0]?.tree as Node)?.styles ?? null;
  });

test('a style state the next selection does not take goes back to Base, and the editor stays drawn', runs(OPEN, SELECT, INSERT, TILE, VISITED, FONT_SIZE), async ({ page }) => {
  await openEditor(page);
  const chooser = page.waitForEvent('filechooser');
  await runDoor(page, OPEN);
  await (await chooser).setFiles({ name: 'aurora.json', mimeType: 'application/json', buffer: fs.readFileSync('manifest/features/fixtures/aurora.json') });
  await expect(page.frameLocator('.frame__page').locator('[data-node="n-title"]')).toHaveCount(1);
  await runDoor(page, SELECT, { args: { target: 'n-intro' } });
  await ensurePanel(page, INSERT);
  await runDoor(page, TILE, { args: { entry: 'link' } });
  await runDoor(page, VISITED);
  await expect(page.locator('.status-bar__message')).toContainText('Editing the Visited state.');

  await runDoor(page, SELECT, { args: { target: 'n-title' } });
  await expect(page.locator('.status-bar__message')).toContainText('Visited does not apply to Heading: editing Base.');
  const field = control(page, FONT_SIZE).locator('input').first();
  await field.click();
  await field.fill('40');
  await field.press('Enter');

  // every region still drawn, none showing that it could not draw
  await expect(page.locator('.region-fallback')).toHaveCount(0);
  for (const region of ['.top-bar', '.inspector', '.status-bar', '.frame__page']) await expect(page.locator(region).first()).toBeVisible();
  // the value went to the Title's base layer; no Visited layer was written
  const styles = await titleStyles(page);
  expect(styles?.desktop?.base?.['font-size']).toBe('40px');
  expect(styles?.desktop?.visited).toBeUndefined();
});
