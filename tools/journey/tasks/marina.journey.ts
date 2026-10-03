// Marina's tasks (jornada03), Portuguese editor. M2 the desktop build (a scripted rebuild along the doors a person
// uses: templates, texts typed in place, the inspector), M3 the canvas at Tablet and Phone against the export of the
// same project, M4 the brand font and images, M5 preview and export. Fidelity (H2/H3) is measured on the export of her
// saved study project by .cache/scratch/audit/fidelity.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../../tests/support/test.ts';
import { unzip } from '../../runner/unzip.ts';
import { measure } from '../fidelity.ts';
import { Task, open, doc, shot, walk, status, nodePoint, RECORDS } from '../kit.ts';
import { fileMenu, rail, pick, key, insert, field, runDoor, crumb } from '../ui.ts';

test.use({ locale: 'pt-BR' });
const PROJECT = 'jornada03/data/downloads/marina-project.zip';
const A = 'jornada03/00-frame/targets/marina/assets';
const FIDELITY = '.cache/logs/journey/fidelity';

test('M3 the canvas at Tablet and Phone, against the export', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'M3');
  await fileMenu(page, 'project.open#menu-file', PROJECT);
  await page.waitForTimeout(800);
  const read = () => page.evaluate(() => {
    const d = document.querySelector<HTMLIFrameElement>('.frame__page')?.contentDocument;
    const els = [...(d?.querySelectorAll<HTMLElement>('[data-node]') ?? [])];
    const sections = els.filter((e) => e.localName === 'section' || e.localName === 'footer').map((e) => getComputedStyle(e).paddingLeft);
    const grids = els.filter((e) => getComputedStyle(e).display === 'grid').map((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    return { sections, grids };
  });
  const results: Record<string, unknown> = {};
  for (const bp of ['desktop', 'tablet', 'phone']) {
    await t.step(`canvas-${bp}`, async () => {
      await page.locator(`[data-door="view.setBreakpoint#toolbar-breakpoint-tabs-${bp}"]`).click();
      await page.waitForTimeout(400);
    });
    results[bp] = await read();
    const plans = await page.evaluate(() => {
      const d = document.querySelector<HTMLIFrameElement>('.frame__page')?.contentDocument;
      const h = [...(d?.querySelectorAll<HTMLElement>('h2') ?? [])].find((e) => (e.textContent ?? '').includes('Planos'));
      h?.scrollIntoView({ block: 'start' });
      return h !== undefined;
    });
    await page.waitForTimeout(200);
    await shot(page, t.front, `planos-${bp}${plans ? '' : '-sem-titulo'}`);
  }
  t.note(`canvas: ${JSON.stringify(results)}`);
  await t.end('done', results);
});

test('M5 preview and export', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'M5');
  await fileMenu(page, 'project.open#menu-file', PROJECT);
  await page.waitForTimeout(800);
  const t0 = Date.now();
  await t.step('pre-visualiza', async () => {
    await page.locator('[data-region="canvas-stage"]').click({ position: { x: 8, y: 8 } });
    await key(page, 'Control+p');
    await page.waitForTimeout(600);
  });
  const preview = await page.locator('[data-region="preview-page"]').count();
  await t.step('telefone-na-previa', async () => {
    await page.locator('[data-door="view.setBreakpoint#toolbar-preview-bar-phone"]').click();
    await page.waitForTimeout(500);
  });
  const previewPlans = await page.frameLocator('[data-region="preview-page"]').locator('h2').filter({ hasText: 'Planos' }).count().catch(() => -1);
  await t.step('sai', async () => {
    await key(page, 'Escape');
  });
  let file = '';
  await t.step('exporta', async () => {
    const download = page.waitForEvent('download');
    await page.locator('[data-door="project.export#toolbar-top-bar-export"]').click();
    const d = await download;
    file = `${RECORDS}/M5-${d.suggestedFilename()}`;
    await d.saveAs(file);
  });
  t.note(`preview frame drawn: ${preview}; plans title in preview: ${previewPlans}; export saved ${file}; ${Math.round((Date.now() - t0) / 1000)} s; status "${await status(page)}"`);
  await t.end(preview === 1 && file !== '' ? 'done' : 'partial', { file });
});

test('M4 brand font and images', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'M4');
  await t.step('secao-titulo-imagem', async () => {
    await insert(page, 'seção', 'Seção');
    await insert(page, 'título', 'Título');
    await insert(page, 'imagem', 'Imagem');
  });
  await rail(page, 'explorer');
  await t.step('envia-arquivos', async () => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-door="files.upload#explorer-upload"]').click();
    await (await chooser).setFiles([`${A}/GraoDisplay.ttf`, `${A}/hero.png`, `${A}/graos.png`]);
    await page.waitForTimeout(600);
  });
  const files = ((await doc(page)).files ?? []).map((f) => f.path);
  t.note(`files after upload: ${files.join(', ')}; status "${await status(page)}"`);
  await t.step('fonte-no-titulo', async () => {
    await pick(page, 'Novo título');
    await field(page, 'style.set#inspector-font-family', 'GraoDisplay');
  });
  const family = await page.evaluate(() => {
    const d = document.querySelector<HTMLIFrameElement>('.frame__page')?.contentDocument;
    const h = d?.querySelector('h2, h1');
    return h ? getComputedStyle(h).fontFamily : null;
  });
  // the font list: is the uploaded font offered (J15)?
  await t.step('lista-de-fontes', async () => {
    const row = page.locator('[data-door="style.set#inspector-font-family"]').first();
    await row.locator('.field__values-button').click();
    await page.waitForTimeout(300);
  });
  const essentials = await page.locator('.field__menu [role^="menuitem"]').allInnerTexts().catch(() => []);
  await page.locator('.field__menu [role^="menuitem"]').filter({ hasText: /Mais valores|More values/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(300);
  await shot(page, t.front, 'mais-valores');
  const offered = [...essentials, ...(await page.locator('.field__menu [role^="menuitem"]').allInnerTexts().catch(() => []))];
  t.note(`essentials offer GraoDisplay: ${essentials.some((o) => /Grao/i.test(o))}; essentials ${essentials.length} items; with More values ${offered.length} items`);
  t.note(`heading font-family on the canvas: ${family}; font list offers GraoDisplay: ${offered.some((o) => /Grao/i.test(o))} (first: ${offered.slice(0, 5).join(' | ')})`);
  await key(page, 'Escape');
  await t.step('imagem-fonte', async () => {
    const d = await doc(page);
    const img = d.pages.flatMap((p) => [...walk(p.tree)]).find((n) => n.type === 'image');
    if (!img) throw new Error('no image');
    const p = await nodePoint(page, img.id);
    if (!p) throw new Error('image not drawn');
    await page.mouse.click(p.x, p.y);
    await runDoor(page, 'workspace.setActiveTab#inspector-tab-settings');
    await page.locator('[data-door="assetPicker.open#inspector-image-src-choose"], [data-door^="assetPicker.open"]').first().click();
    await page.waitForTimeout(300);
    await shot(page, t.front, 'seletor-de-imagens');
    await page.locator('[data-door^="element.setAttribute"]').filter({ hasText: 'hero' }).first().click();
  });
  const src = (await doc(page)).pages.flatMap((p) => [...walk(p.tree)]).find((n) => n.type === 'image')?.attributes?.src;
  t.note(`image src after the picker: ${String(src)}; status "${await status(page)}"`);
  await shot(page, t.front, 'final');
  await t.end(files.length >= 3 && /Grao/.test(String(family)) && typeof src === 'string' && src.includes('hero') ? 'done' : 'partial', { family, src, offered: offered.slice(0, 8) });
  expect(true).toBe(true);
});

// H2 and H3: the fidelity of Marina's saved study project as the editor exports it now, against the client's page, at
// the four widths (tools/journey/fidelity.ts, the study's method). Desktop wants 85 % and the tablet and phone 80 %.
test('H2 H3 fidelity of the saved project export', async ({ page, context }) => {
  await open(page);
  const t = new Task(page, 'H2-H3');
  await fileMenu(page, 'project.open#menu-file', PROJECT);
  await page.waitForTimeout(800);
  const site = path.join(FIDELITY, 'marina-site');
  await t.step('exporta', async () => {
    const download = page.waitForEvent('download');
    await page.locator('[data-door="project.export#toolbar-top-bar-export"]').click();
    const zip = await (await download).path();
    fs.rmSync(site, { recursive: true, force: true });
    for (const [name, bytes] of unzip(fs.readFileSync(zip))) {
      fs.mkdirSync(path.dirname(path.join(site, name)), { recursive: true });
      fs.writeFileSync(path.join(site, name), bytes);
    }
  });
  const measuring = await context.newPage();
  const results = await measure(measuring, site, 'jornada03/00-frame/targets/marina/index.html', FIDELITY, 'marina');
  await measuring.close();
  const at = (width: number) => results.find((r) => r.width === width);
  t.note(`fidelity: ${results.map((r) => `${r.width} ${r.pixelMatchCommon} % common, ${r.pixelMatchAdjusted} % adjusted`).join('; ')}`);
  const met = (at(1440)?.pixelMatchCommon ?? 0) >= 85 && (at(834)?.pixelMatchCommon ?? 0) >= 80 && (at(390)?.pixelMatchCommon ?? 0) >= 80;
  await t.end(met ? 'done' : 'partial', { fidelity: results });
});

// M3 again (H3, plan phase G2): in the study the export lost the tablet and phone styles (the audit's AUD-02, fixed in
// QA 150), so Marina's adjustments at those widths were made against a page that did not show them. Redone with the
// editor as it is: what the page drifts by against the design at 390 (.cache/scratch/landmarks.mts, boxes.mts: the
// page's line height, the section and card titles' size, line height and margin, the prices' line height, the FAQ
// items' padding, the benefit pictures' margin, the hero's gaps, the quote's line height) set at Desktop, then the
// spacing the
// design's specification gives at 834 and 390 (the hero's top and bottom padding, the quote's) set at the Tablet and
// Phone tabs, every value through the inspector's fields, then the export measured again.
test('M3R the tablet and phone spacing set from the design, then the fidelity', async ({ page, context }) => {
  await open(page);
  const t = new Task(page, 'M3R');
  await fileMenu(page, 'project.open#menu-file', PROJECT);
  await page.waitForTimeout(800);
  const padding = async (top: string, bottom: string) => {
    await field(page, 'style.setSpacing#inspector-padding-top-box-model', top);
    await field(page, 'style.setSpacing#inspector-padding-bottom-box-model', bottom);
  };
  await t.step('pagina-entrelinha', async () => {
    await pick(page, 'Café de especialidade');
    await crumb(page, 'Page');
    await field(page, 'style.set#inspector-line-height', '1.6');
  });
  await t.step('titulos-dos-beneficios', async () => {
    await pick(page, 'Origem rastreada');
    await pick(page, 'Torra fresca', 1, ['Shift']);
    await pick(page, 'Sem fidelidade', 1, ['Shift']);
    await field(page, 'style.set#inspector-font-size', '22');
    await field(page, 'style.set#inspector-line-height', '1.15');
    await field(page, 'style.setSpacing#inspector-margin-bottom-box-model', '16');
  });
  await t.step('titulos-das-secoes', async () => {
    await pick(page, 'Por que o Grão Norte');
    await pick(page, 'Planos de assinatura', 1, ['Shift']);
    await pick(page, 'Dúvidas', 2, ['Shift']);
    await field(page, 'style.set#inspector-line-height', '1.15');
    await field(page, 'style.setSpacing#inspector-margin-bottom-box-model', '40');
  });
  await t.step('titulos-dos-planos', async () => {
    await pick(page, 'Degustação');
    await pick(page, 'Casa', 1, ['Shift']);
    await pick(page, 'Escritório', 1, ['Shift']);
    await field(page, 'style.set#inspector-font-size', '22');
    await field(page, 'style.set#inspector-line-height', '1.15');
    await field(page, 'style.setSpacing#inspector-margin-bottom-box-model', '16');
  });
  await t.step('precos', async () => {
    await pick(page, 'R$ 39');
    await pick(page, 'R$ 69', 1, ['Shift']);
    await pick(page, 'R$ 149', 1, ['Shift']);
    await field(page, 'style.set#inspector-line-height', 'normal');
    await field(page, 'style.setSpacing#inspector-margin-bottom-box-model', '8');
  });
  await t.step('destaque-espacos', async () => {
    await pick(page, 'Café de especialidade');
    await crumb(page, 'Destaque');
    await field(page, 'style.set#inspector-row-gap', '48');
    await pick(page, 'Café de especialidade');
    await crumb(page, 'Coluna');
    await field(page, 'style.set#inspector-row-gap', '0');
  });
  for (const title of ['Origem rastreada', 'Torra fresca', 'Sem fidelidade']) {
    await t.step(`imagem-${title.slice(0, 8)}`, async () => {
      await pick(page, title);
      await key(page, 'ArrowLeft');
      await field(page, 'style.setSpacing#inspector-margin-bottom-box-model', '16');
    });
  }
  await t.step('citacao-entrelinha', async () => {
    await pick(page, '“O melhor café');
    await field(page, 'style.set#inspector-line-height', '1.4');
  });
  for (const question of ['Quando o café chega?', 'Posso trocar de plano?', 'Vocês entregam em todo o Brasil?']) {
    await t.step(`faq-${question.slice(0, 12)}`, async () => {
      await pick(page, question);
      await crumb(page, 'Detalhes');
      await padding('20', '20');
    });
  }
  await t.step('tablet', async () => {
    await page.locator('[data-door="view.setBreakpoint#toolbar-breakpoint-tabs-tablet"]').click();
  });
  await t.step('tablet-destaque', async () => {
    await pick(page, 'Café de especialidade');
    await crumb(page, 'Destaque');
    await padding('32', '56');
  });
  await t.step('celular', async () => {
    await page.locator('[data-door="view.setBreakpoint#toolbar-breakpoint-tabs-phone"]').click();
  });
  await t.step('celular-destaque', async () => {
    await pick(page, 'Café de especialidade');
    await crumb(page, 'Destaque');
    await padding('24', '40');
  });
  await t.step('celular-citacao', async () => {
    await pick(page, '“O melhor');
    await crumb(page, 'Seção 2');
    await padding('40', '40');
  });
  const site = path.join(FIDELITY, 'marina-m3r-site');
  await t.step('exporta', async () => {
    const download = page.waitForEvent('download');
    await page.locator('[data-door="project.export#toolbar-top-bar-export"]').click();
    const zip = await (await download).path();
    fs.rmSync(site, { recursive: true, force: true });
    for (const [name, bytes] of unzip(fs.readFileSync(zip))) {
      fs.mkdirSync(path.dirname(path.join(site, name)), { recursive: true });
      fs.writeFileSync(path.join(site, name), bytes);
    }
  });
  const measuring = await context.newPage();
  const results = await measure(measuring, site, 'jornada03/00-frame/targets/marina/index.html', FIDELITY, 'marina-m3r');
  await measuring.close();
  const share = (width: number) => results.find((r) => r.width === width)?.pixelMatchCommon ?? 0;
  t.note(`fidelity: ${results.map((r) => `${r.width} ${r.pixelMatchCommon} % common, ${r.pixelMatchAdjusted} % adjusted`).join('; ')}`);
  await t.end(t.deadEnds.length === 0 && share(834) >= 80 && share(390) >= 80 ? 'done' : 'partial', { fidelity: results });
});
