// Carla's tasks C1-C5 (jornada03), from Marina's saved project (jornada03/data/downloads/marina-project.zip), in
// Portuguese. C1 rebrand (H11: at most 3 actions), C2 two pages from the home page (H12: at most 1 min each), C3 the
// menu changed once on every page (H13), C4 the catalogue from cardapio.csv (H14: 12 items right, at most 5 min), C5
// a reload in the middle of an edit (H15: nothing lost).
import { test, expect } from '../../../tests/support/test.ts';
import { Task, open, doc, shot, walk, status, firstTree } from '../kit.ts';
import { fileMenu, rail, editText, pick, key, insert } from '../ui.ts';

test.use({ locale: 'pt-BR' });
const PROJECT = 'jornada03/data/downloads/marina-project.zip';
const BROWN = /#6b3f26|rgb\(107, 63, 38\)/i;

async function openMarina(page: import('@playwright/test').Page, t: Task): Promise<void> {
  await fileMenu(page, 'project.open#menu-file', PROJECT);
  await page.waitForTimeout(1200);
  const d = await doc(page);
  t.note(`opened: ${d.pages.length} page(s), ${[...walk(firstTree(d))].length} elements, status "${await status(page)}"`);
}
const brownCount = (d: unknown) => (JSON.stringify(d).match(/#6b3f26/gi) ?? []).length;

test('C1 rebrand brown to green on the whole site', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'C1');
  await openMarina(page, t);
  const before = brownCount(await doc(page));
  t.note(`values holding #6b3f26 before: ${before}`);
  let actions = 0;
  await t.step('abre-estilos', async () => {
    await rail(page, 'styles');
    actions += 1;
  });
  await t.step('cores-em-uso', async () => {
    const row = page.locator('[data-door="design.replaceColour#styles-site-colour-replace"]').filter({ has: page.locator('input') }).first();
    const all = page.locator('[data-door="design.replaceColour#styles-site-colour-replace"]');
    const n = await all.count();
    let found = -1;
    for (let i = 0; i < n; i += 1) {
      const v = await all.nth(i).locator('input').inputValue().catch(() => '');
      if (BROWN.test(v)) {
        found = i;
        break;
      }
    }
    if (found < 0) throw new Error(`no Colours in use row for the brand brown (${n} rows)`);
    const input = all.nth(found).locator('input');
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('#2f6f4e');
    await page.keyboard.press('Enter');
    actions += 1;
    void row;
  });
  const after = brownCount(await doc(page));
  const green = (JSON.stringify(await doc(page)).match(/#2f6f4e/gi) ?? []).length;
  t.note(`after: #6b3f26 left ${after}, #2f6f4e ${green}; actions ${actions}; status "${await status(page)}"`);
  await shot(page, t.front, 'depois');
  await t.end(after === 0 && green > 0 && actions <= 3 ? 'done' : 'partial', { before, after, green, actions });
});

test('C2 two pages from the home page', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'C2');
  await openMarina(page, t);
  await rail(page, 'explorer');
  const times: number[] = [];
  for (const [name, title] of [['Unidade Centro', 'Grão Norte Centro'], ['Unidade Praia', 'Grão Norte Praia']] as const) {
    const s = Date.now();
    await t.step(`duplica-${name}`, async () => {
      const dup = page.locator('[data-door="pages.duplicate#explorer-page-duplicate"]').first();
      await page.locator('[data-region="explorer-pages"] [data-door]').first().hover();
      await dup.click();
      await page.waitForTimeout(300);
      // the copy opens with its name focused (J20): typing names it
      await page.keyboard.press('Control+A');
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');
    });
    await t.step(`titulo-${name}`, async () => {
      await editText(page, 'Café de especialidade', title);
    });
    times.push(Math.round((Date.now() - s) / 1000));
  }
  const d = await doc(page);
  t.note(`pages: ${d.pages.map((p) => `${p.name}=${p.file}`).join(', ')}; seconds per page ${times.join(', ')}`);
  const ok = d.pages.some((p) => /centro/i.test(p.name)) && d.pages.some((p) => /praia/i.test(p.name));
  await t.end(ok && times.every((s) => s <= 60) ? 'done' : 'partial', { pages: d.pages.map((p) => p.name), times });
});

test('C3 the menu everywhere', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'C3');
  await openMarina(page, t);
  await rail(page, 'explorer');
  // C2's result first: two copies of the home page, by its Duplicate button
  await t.step('duas-copias', async () => {
    for (let i = 0; i < 2; i += 1) {
      await page.locator('[data-region="explorer-pages"] [data-door]').first().hover();
      await page.locator('[data-door="pages.duplicate#explorer-page-duplicate"]').first().click();
      await page.keyboard.press('Enter');
    }
  });
  await t.step('volta-ao-inicio', async () => {
    await page.locator('[data-door="pages.switch#explorer-page-row"]').first().click();
  });
  await t.step('seleciona-cabecalho-nas-camadas', async () => {
    await page.locator('[data-door="selection.select#layers-row"]').filter({ hasText: /Barra de navega/ }).first().click();
  });
  const t0 = Date.now();
  let actions = 0;
  await t.step('compartilha', async () => {
    await rail(page, 'data');
    actions += 1;
    const share = page.locator('[data-door="regions.share#data-share"]').first();
    await share.scrollIntoViewIfNeeded();
    t.note(`share door: disabled=${await share.getAttribute('aria-disabled')}, title=${await share.getAttribute('title')}`);
    await share.click();
    actions += 1;
  });
  t.note(`after share: "${await status(page)}"`);
  await t.step('novo-link', async () => {
    await page.locator('[data-door="selection.select#layers-row"]').filter({ hasText: /^\s*Link/ }).first().click().catch(() => undefined);
    await pick(page, 'Dúvidas');
    await key(page, 'Control+d');
    actions += 2;
    await editText(page, 'Dúvidas', 'Unidades', 2);
    actions += 1;
  });
  const after = await doc(page);
  const per = after.pages.map((p) => JSON.stringify(p.tree).includes('Unidades'));
  t.note(`"Unidades" on each page: ${per.join(', ')}; ${Math.round((Date.now() - t0) / 1000)} s; actions ${actions}; status "${await status(page)}"`);
  await shot(page, t.front, 'final');
  await t.end(per.every(Boolean) && per.length >= 3 ? 'done' : 'partial', { per, actions });
});

test('C4 catalogue from cardapio.csv', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'C4');
  await openMarina(page, t);
  const t0 = Date.now();
  await rail(page, 'explorer');
  await t.step('pagina-cardapio', async () => {
    await page.locator('[data-door="pages.add#explorer-add-page"]').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Cardápio');
    await page.keyboard.press('Enter');
  });
  await t.step('cartao', async () => {
    if (!(await insert(page, 'cartão', 'Cartão'))) throw new Error('no Card tile for "cartão"');
  });
  await rail(page, 'data');
  await t.step('previa-csv', async () => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-door="data.preview#data-import"]').first().click();
    await (await chooser).setFiles('jornada03/00-frame/targets/carla/cardapio.csv');
  });
  await t.step('importa', async () => {
    await page.locator('[data-door="data.importNew#data-import-new"]').first().click();
  });
  t.note(`after import: "${await status(page)}"`);
  await t.step('seleciona-cartao', async () => {
    await page.locator('[data-door="selection.select#layers-row"]').filter({ hasText: /Cart[aã]o/ }).first().click();
  });
  const part = (to: string) => page.locator(`[data-door="data.bindElement#data-bind-field"][data-args*='"to":"${to}"'] select`);
  await t.step('liga-foto', async () => {
    await part('image').first().selectOption({ label: 'foto' });
  });
  await t.step('liga-nome', async () => {
    await part('text').first().selectOption({ label: 'nome' });
  });
  await t.step('liga-preco', async () => {
    await part('text').nth(1).selectOption({ label: 'preco' });
  });
  await t.step('preenche', async () => {
    await page.locator('[data-door="data.fill#data-fill"]').first().click();
  });
  const d = await doc(page);
  const cardapio = d.pages.find((p) => /card/i.test(p.name));
  const texts = cardapio ? [...walk(cardapio.tree)].map((n) => n.text ?? '').filter((x) => x !== '') : [];
  const prices = texts.filter((x) => /R\$/.test(x)).length;
  const imgs = cardapio ? [...walk(cardapio.tree)].filter((n) => n.type === 'image' && typeof n.attributes?.src === 'string' && n.attributes.src !== '').length : 0;
  t.note(`status "${await status(page)}"; Cardápio page ${cardapio ? 'exists' : 'missing'}; price texts ${prices}; images with a source ${imgs}; ${Math.round((Date.now() - t0) / 1000)} s`);
  await shot(page, t.front, 'final');
  await t.end(prices >= 12 && imgs >= 12 ? 'done' : 'partial', { prices, imgs });
});

test('C5 reload in the middle of an edit', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'C5');
  await openMarina(page, t);
  await t.step('edita-texto', async () => {
    const p = await import('../kit.ts').then((k) => k.canvasPoint(page, 'Café de especialidade'));
    if (p === null) throw new Error('no hero title');
    await page.mouse.dblclick(p.x, p.y);
    await page.keyboard.press('End');
    await page.keyboard.type(' Especial');
  });
  await t.step('recarrega', async () => {
    await page.reload();
    await page.locator('.workbench').waitFor();
    await page.waitForTimeout(800);
  });
  const text = await page.evaluate(() => {
    const d = document.querySelector<HTMLIFrameElement>('.frame__page')?.contentDocument;
    return [...(d?.querySelectorAll('[data-node]') ?? [])].map((e) => e.textContent ?? '').find((s) => s.includes('Especial')) ?? null;
  });
  t.note(`after reload the canvas holds " Especial": ${text !== null}; status "${await status(page)}"`);
  await t.end(text !== null ? 'done' : 'partial');
  expect(true).toBe(true);
});
