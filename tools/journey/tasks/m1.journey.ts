// M1 first contact (jornada03): Marina, a Portuguese browser, an empty app, no help: a section with a title, a
// paragraph and a button. H1: done in at most 5 minutes with at most 1 dead end. The study's two dead ends were the
// accent-sensitive search ("titulo") and "texto" giving form fields only.
import { test, expect } from '../../../tests/support/test.ts';
import { Task, open, doc, walk, shot, firstTree } from '../kit.ts';
import { insert, tilesFor } from '../ui.ts';

test.use({ locale: 'pt-BR' });

test('M1 first contact', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'M1');
  await shot(page, t.front, 'abre-em-pt-BR');
  const language = await page.locator('html').getAttribute('lang');
  t.note(`editor language at first open: ${language}; first panel: ${await page.locator('[data-region="panel-header"]').first().innerText().catch(() => '?')}`);
  for (const [term, tile] of [['seção', 'Seção'], ['titulo', 'Título'], ['texto', 'Parágrafo'], ['botao', 'Botão']] as const) {
    await t.step(`busca-${term}`, async () => {
      const shown = await tilesFor(page, term);
      t.note(`search "${term}" shows: ${shown.slice(0, 6).join(' | ')}`);
      if (!shown.some((s) => s.trim().toLowerCase() === tile.toLowerCase())) throw new Error(`"${term}" does not offer ${tile}`);
      if (shown[0]?.trim().toLowerCase() !== tile.toLowerCase()) t.note(`"${term}": ${tile} is not the first result (${shown[0]})`);
      const placed = await insert(page, term, tile);
      if (!placed) throw new Error(`no tile ${tile}`);
    });
  }
  const d = await doc(page);
  const root = firstTree(d);
  const section = [...walk(root)].find((n) => n.type === 'section');
  const inside = section === undefined ? [] : [...walk(section)].map((n) => n.type);
  const ok = section !== undefined && inside.includes('heading') && inside.includes('paragraph') && inside.includes('button');
  if (!ok) t.deadEnd(`document: section ${section ? 'holds ' + inside.join(',') : 'missing'}; root holds ${root.children.map((c) => c.type).join(',')}`);
  await shot(page, t.front, 'resultado');
  const r = await t.end(ok && t.deadEnds.length <= 1 ? 'done' : ok ? 'partial' : 'partial', { tree: [...walk(root)].map((n) => n.type) });
  expect(r.consoleErrors).toEqual([]);
});
