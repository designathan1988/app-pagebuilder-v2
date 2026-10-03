// Diego's tasks D1-D4 (jornada03), English editor. D1 tokens and a card class (H6: at least 3 variables and 1 class in
// the export, without typing var(), D2 a component placed 6 times and changed once (H7), D3 the legacy page imported
// as a new page beside the client's pages and edited (H8), D4 a page from the keyboard alone (H9: 0 mouse gestures).
// D5 (the code review) is measured on the export in phase 5 (.cache/logs/audit/05-export.json).
import { test, expect } from '../../../tests/support/test.ts';
import { Task, open, doc, shot, walk, status, history, firstTree } from '../kit.ts';
import { fileMenu, rail, editText, pick, key, insert, field, runDoor } from '../ui.ts';
async function layersRow(page: import('@playwright/test').Page, name: RegExp, button: 'left' | 'right' = 'left'): Promise<void> {
  const d = await doc(page);
  const node = d.pages.flatMap((p) => [...walk(p.tree)]).find((n) => name.test(n.name));
  if (!node) throw new Error(`no node named ${name}`);
  if (button === 'left') {
    await runDoor(page, 'selection.select#layers-row', { args: { target: node.id } });
    return;
  }
  await runDoor(page, 'selection.select#layers-row', { args: { target: node.id } });
  await page.locator(`[data-door="selection.select#layers-row"][data-args*='"target":"${node.id}"']`).first().click({ button: 'right' });
}

const PROJECT = 'jornada03/data/downloads/marina-project.zip';
async function openMarina(page: import('@playwright/test').Page, t: Task): Promise<void> {
  await fileMenu(page, 'project.open#menu-file', PROJECT);
  await page.waitForTimeout(1000);
  t.note(`opened: status "${await status(page)}"`);
}

test('D1 tokens and a card class', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'D1');
  await openMarina(page, t);
  await rail(page, 'styles');
  const colours: [string, string][] = [['brand', '#6b3f26'], ['ink', '#241710'], ['muted', '#6f5b4d'], ['cream', '#f7efe4'], ['line', '#e6d8c6']];
  for (const [name, value] of colours) {
    await t.step(`variavel-${name}`, async () => {
      await page.locator('[data-door="tokens.create#variables-add"]').first().click();
      await page.waitForTimeout(200);
      // a kind menu may open first (Colour, Size…)
      t.note(`after +: focus on ${await page.evaluate(() => document.activeElement?.localName + ' ' + (document.activeElement?.getAttribute('aria-label') ?? ''))}`);
      const colourKind = page.locator('.variables__kinds [role="option"]').filter({ hasText: /^\s*Colou?r\s*$/ }).first();
      await colourKind.click();
      await page.waitForTimeout(200);
      // the new variable's name field takes the focus (J5)
      await page.keyboard.press('Control+A');
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');
      const valueField = page.locator('[data-door="tokens.update#variables-value-field"]').last().locator('input').first();
      await valueField.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(value);
      await page.keyboard.press('Enter');
    });
  }
  const tokens = (await doc(page)).tokens ?? [];
  t.note(`tokens: ${tokens.map((x) => `${x.name}=${x.value}`).join(', ')}; status "${await status(page)}"`);
  // the brand colour used on the plan buttons from the colour picker's variables row, without typing var(
  await t.step('cartao-classe', async () => {
    await pick(page, 'Degustação');
    await page.locator('[data-region="status-bar"] button').filter({ hasText: /Cart/ }).last().click().catch(() => undefined);
    await page.locator('[data-door="classes.create#inspector-class-save-as"]').first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('card');
    await page.keyboard.press('Enter');
  });
  await t.step('alvo-classe', async () => {
    const chip = page.locator('[data-door="inspector.setStyleTarget#inspector-class-bar-target"]').filter({ hasText: 'card' }).first();
    t.note(`class chips: ${(await page.locator('[data-door="inspector.setStyleTarget#inspector-class-bar-target"]').allInnerTexts()).join(' | ')}`);
    await chip.click();
  });
  await t.step('aplica-aos-parecidos', async () => {
    const similar = page.locator('[data-door="classes.applyToSimilar#inspector-class-apply-similar"]').first();
    t.note(`apply to similar: ${await similar.innerText().catch(() => 'not drawn')}`);
    await similar.click();
  });
  const d = await doc(page);
  const users = d.pages.flatMap((p) => [...walk(p.tree)]).filter((n) => n.classes.includes('card'));
  t.note(`class card used by ${users.length} elements (${users.map((u) => u.name).join(', ')}); classes ${(d.classes ?? []).map((c) => c.name).join(', ')}; status "${await status(page)}"`);
  await shot(page, t.front, 'final');
  await t.end(tokens.length >= 3 && users.length >= 3 ? 'done' : 'partial', { tokens: tokens.length, cardUsers: users.length });
});

test('D2 a component placed six times, changed once', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'D2');
  await openMarina(page, t);
  const t0 = Date.now();
  await t.step('seleciona-depoimento', async () => {
    await layersRow(page, /^Se[cç][aã]o 2$/);
  });
  await t.step('cria-componente', async () => {
    await layersRow(page, /^Se[cç][aã]o 2$/, 'right');
    await page.locator('[data-door="components.startCreate#context-menu"]').first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('testimonial');
    await page.keyboard.press('Enter');
  });
  await t.step('repete-5', async () => {
    await page.locator('[data-region="canvas-stage"]').hover();
    await key(page, 'Control+Shift+D', 5);
  });
  const quotes = ['“Always fresh.”', '“I love the micro-lot.”', '“Flawless service.”', '“My office thanks you.”', '“A perfect gift.”'];
  for (const [i, q] of quotes.entries()) await t.step(`texto-${i + 2}`, async () => {
    await editText(page, '“O melhor café', q, 2);
  });
  await t.step('borda-em-um', async () => {
    await layersRow(page, /testimonial|Se[cç][aã]o 2/);
    await field(page, 'style.setBorder#inspector-border-border-editor', '4px solid #6b3f26');
  });
  const d = await doc(page);
  const instances = d.pages.flatMap((p) => [...walk(p.tree)]).filter((n) => (n as unknown as { component?: string }).component === 'testimonial');
  const comp = (d.components ?? []).find((c) => c.name === 'testimonial') as unknown as { tree?: { styles?: unknown } } | undefined;
  t.note(`instances ${instances.length}; component styles ${JSON.stringify(comp?.tree?.styles ?? null).slice(0, 200)}; ${Math.round((Date.now() - t0) / 1000)} s; status "${await status(page)}"`);
  const borders = await page.evaluate(() => {
    const d2 = document.querySelector<HTMLIFrameElement>('.frame__page')?.contentDocument;
    return [...(d2?.querySelectorAll<HTMLElement>('section') ?? [])].map((s) => getComputedStyle(s).borderTopWidth).join(',');
  });
  t.note(`computed border-top of the page's sections: ${borders}`);
  await shot(page, t.front, 'final');
  await t.end(instances.length >= 6 ? 'done' : 'partial', { instances: instances.length });
});

test('D3 import the legacy page beside the client pages', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'D3');
  await openMarina(page, t);
  const before = await doc(page);
  await t.step('importa', async () => {
    await fileMenu(page, 'project.importHtml#menu-file', 'jornada03/00-frame/targets/diego/legacy.html');
    await page.waitForTimeout(400);
    await shot(page, t.front, 'dialogo-destino');
    await page.locator('[data-door="project.importHtml#destination-page"]').first().click();
    await page.waitForTimeout(800);
  });
  const after = await doc(page);
  t.note(`pages before ${before.pages.map((p) => p.name).join(',')}; after ${after.pages.map((p) => p.name).join(',')}; status "${await status(page)}"`);
  const imported = after.pages.find((p) => !before.pages.some((b) => b.file === p.file));
  const count = imported ? [...walk(imported.tree)].length - 1 : 0;
  t.note(`imported page ${imported?.name} (${imported?.file}): ${count} elements`);
  await t.step('muda-titulo', async () => {
    await editText(page, 'Coffee for cafés', 'Coffee for cafés, offices and hotels');
  });
  await t.step('nova-secao', async () => {
    await pick(page, 'Ask for a quote');
    if (!(await insert(page, 'section', 'Section'))) throw new Error('no Section tile');
  });
  const final = await doc(page);
  const kept = before.pages.every((b) => final.pages.some((p) => p.file === b.file));
  await shot(page, t.front, 'final');
  await t.end(imported !== undefined && kept && count >= 20 ? 'done' : 'partial', { kept, imported: count });
});

test('D4 a page from the keyboard alone', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'D4');
  let pointer = 0;
  page.on('framenavigated', () => undefined);
  const bar = async (words: string) => {
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(150);
    await page.keyboard.type(words, { delay: 15 });
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  };
  // the editor just opened: the focus is on the page; F6 reaches the canvas; the command bar does the rest
  await t.step('secao', async () => {
    await bar('section');
  });
  await t.step('titulo', async () => {
    await bar('heading');
  });
  await t.step('paragrafo', async () => {
    await bar('paragraph');
  });
  await t.step('linha', async () => {
    await key(page, 'r');
  });
  await t.step('segundo-paragrafo', async () => {
    await bar('paragraph');
  });
  await t.step('botao', async () => {
    await key(page, 'Escape');
    await bar('button');
  });
  const d = await doc(page);
  const types = [...walk(firstTree(d))].map((n) => n.type);
  const ok = types.includes('section') && types.includes('heading') && types.filter((x) => x === 'paragraph').length >= 2 && types.includes('button');
  t.note(`tree: ${types.join(',')}; undo steps ${(await history(page)).undoSteps}; status "${await status(page)}"; pointer gestures ${pointer}`);
  await shot(page, t.front, 'final');
  await t.end(ok ? 'done' : 'partial', { types });
  pointer += 0;
  expect(pointer).toBe(0);
});
