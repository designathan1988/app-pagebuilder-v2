// The label colour of a Layers row (manifest feature layers-row-colours; spec layers-row-colours): the dot of a row
// opens the palette (the design tokens interactions.json names), a swatch writes the colour into the page's own list,
// the row wears it, the canvas draws the element's selection in it, it survives a reload — and it never reaches the
// export: the colour is the person's note about a layer, not a style of the page.
import fs from 'node:fs';
import { expect, test, type Page } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { unzip } from '../../tools/runner/unzip.ts';
import { runDoor } from './door.ts';

const INSERT_PANEL = 'workspace.setPanelOpen#toolbar-activity-bar-insert';
const TILE = 'element.insert#elements-tile';
const DOT = 'element.setLayerColor#layers-row-colour-dot';
const EXPORT = 'project.export#toolbar-top-bar-export';
const TOKEN = '--color-canvas-measure';

const documentOf = (page: Page): Promise<{ pages: { tree: { layerColors?: readonly { node: string; colour: string }[] } }[] }> =>
  page.evaluate(() => (window as unknown as { __builderTestPort: { document: () => never } }).__builderTestPort.document());

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await runDoor(page, INSERT_PANEL, {});
  await runDoor(page, TILE, { args: { entry: 'heading' } });
}

test('a swatch writes the colour, the row wears it and the canvas draws it', async ({ page }) => {
  await open(page);
  const row = page.locator('[data-door="selection.select#layers-row"]').last();
  await expect(row, 'the row of the new heading').toBeVisible();
  // the palette: one swatch per token the manifest names, each carrying its own colour
  // the row's dot opens the palette (its own command re-writes the colour the row holds, so the press changes
  // nothing), and the swatch writes the colour
  await row.locator(`[data-door="${DOT}"][data-args*='"color":""']`).first().click();
  const swatch = row.locator(`[data-door="${DOT}"][data-args*='"color":"${TOKEN}"']`);
  await expect(swatch, 'the row’s palette offers the token').toHaveCount(1);
  await swatch.click();
  await expect(page.getByRole('status')).toHaveText('Heading has a label colour.');
  const held = (await documentOf(page)).pages[0]?.tree.layerColors ?? [];
  expect(held, 'the colour is the page’s own list').toEqual([{ node: await row.getAttribute('data-args').then((args) => JSON.parse(args ?? '{}').target), colour: TOKEN }]);
  // the row wears it (the line on its left) and the canvas draws the selection in it
  await expect(row).toHaveClass(/is-coloured/);
  const line = await row.evaluate((el) => getComputedStyle(el).borderLeftColor);
  const outline = await page.locator('[data-chrome="selection"]').first().evaluate((el) => getComputedStyle(el).outlineColor);
  expect(line, 'the row’s line is the colour the token stands for').not.toBe('rgba(0, 0, 0, 0)');
  expect(outline, 'the canvas selection wears the same colour').toBe(line);
  // the very colour the token stands for (LC2: drawn by its bare name, the token was no colour, so the line fell back
  // to the text's ink and the outline with it, which the two checks above let pass)
  const tokenColour = await page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, TOKEN);
  expect(line, 'the row’s line is the token’s own colour').toBe(tokenColour);
  await expect(row.locator('.row__colour-dot'), 'the row’s dot wears it too').toHaveCSS('background-color', tokenColour);
  // and it survives a reload (the document holds it)
  await page.reload();
  await expect(page.locator('.workbench')).toBeVisible();
  expect((await documentOf(page)).pages[0]?.tree.layerColors ?? [], 'the colour is still there after a reload').toEqual(held);
});

test('the colour is the editor’s own: it never reaches the export', async ({ page }) => {
  await open(page);
  await page.locator(`[data-door="${DOT}"][data-args*='"color":""']`).last().click();
  await page.locator(`[data-door="${DOT}"][data-args*='"color":"${TOKEN}"']`).last().click();
  await expect(page.getByRole('status')).toHaveText('Heading has a label colour.');
  const download = page.waitForEvent('download');
  await runDoor(page, EXPORT, {});
  const files = unzip(fs.readFileSync(await (await download).path()));
  const html = files.get('index.html')?.toString('utf8') ?? '';
  const css = files.get('css/styles.css')?.toString('utf8') ?? '';
  expect(html, 'the page was written').not.toBe('');
  expect(html, 'no trace of the label colour in the HTML').not.toContain(TOKEN);
  expect(css, 'no trace of the label colour in the stylesheet').not.toContain(TOKEN);
});
