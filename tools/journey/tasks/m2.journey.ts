// M2 desktop build (jornada03): Marina rebuilds the Grão Norte landing page — nav, hero with image, 3 benefits, the
// testimonial, 3 price cards, FAQ, footer — through the doors a person uses: Insert templates, texts typed on the
// canvas, the inspector's fields. This is a feasibility run (every section reachable without a dead end, in real
// gestures); the persona's own fidelity is measured on the export of her saved study project.
import { test, expect } from '../../../tests/support/test.ts';
import { Task, open, doc, shot, walk, status, firstTree } from '../kit.ts';
import { insert, editText, pick, field, key, crumb } from '../ui.ts';

test.use({ locale: 'pt-BR' });

test('M2 desktop build', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'M2');
  const t0 = Date.now();
  const tile = async (term: string, name: string) => {
    if (!(await insert(page, term, name))) throw new Error(`no tile ${name} for "${term}"`);
  };
  await t.step('navbar', async () => {
    await tile('navegação', 'Barra de navegação');
  });
  await t.step('hero', async () => {
    await tile('destaque', 'Destaque');
  });
  for (const [from, to] of [['Marca', 'Grão Norte'], ['Início', 'Nossos cafés'], ['Sobre', 'Assinatura'], ['Contato', 'Dúvidas'], ['Um título claro', 'Café de especialidade, torrado na semana em que chega à sua casa'], ['Uma linha de apoio', 'Grãos de pequenos produtores do sul de Minas, torra artesanal e entrega mensal.']] as const) {
    await t.step(`texto-${from}`, async () => {
      await editText(page, from, to);
    });
  }
  await t.step('botao-hero', async () => {
    await editText(page, 'Começar', 'Conhecer os planos');
  });
  await t.step('estilo-titulo', async () => {
    await pick(page, 'Café de especialidade');
    await field(page, 'style.set#inspector-font-size', '56');
  });
  await t.step('estilo-lead', async () => {
    await pick(page, 'Grãos de pequenos');
    await field(page, 'style.set#inspector-font-size', '20');
    await field(page, 'style.set#inspector-color', '#6f5b4d');
  });
  await t.step('fundo-hero', async () => {
    await pick(page, 'Café de especialidade');
    await crumb(page, 'Destaque');
    await field(page, 'style.set#inspector-background-color', '#f7efe4');
  });
  await t.step('beneficios', async () => {
    await tile('seção', 'Seção');
    await tile('título', 'Título');
    await tile('grade', 'Grade');
    await tile('cartão', 'Cartão');
    await key(page, 'Control+Shift+D', 2);
  });
  await t.step('titulo-beneficios', async () => {
    await editText(page, 'Novo título', 'Por que o Grão Norte');
  });
  for (const [i, [a, b]] of ([['Origem rastreada', 'Você sabe de qual fazenda veio cada pacote.'], ['Torra fresca', 'Torramos toda semana, só o que vamos enviar.'], ['Sem fidelidade', 'Pause ou cancele a assinatura quando quiser.']] as const).entries()) {
    await t.step(`cartao-${i + 1}`, async () => {
      await editText(page, 'Título do cartão', a);
      await editText(page, 'Uma descrição curta', b);
    });
  }
  await t.step('depoimento', async () => {
    await pick(page, 'Por que o Grão');
    await crumb(page, 'Seção');
    await tile('seção', 'Seção');
    await tile('parágrafo', 'Parágrafo');
    await editText(page, 'Um parágrafo', '“O melhor café que já entrou na minha cozinha.”');
  });
  await t.step('fundo-depoimento', async () => {
    await pick(page, '“O melhor');
    await crumb(page, 'Seção');
    await field(page, 'style.set#inspector-background-color', '#6b3f26');
    await field(page, 'style.set#inspector-color', '#ffffff');
  });
  await t.step('planos', async () => {
    await tile('seção', 'Seção');
    await tile('título', 'Título');
    await editText(page, 'Novo título', 'Planos de assinatura');
    await tile('grade', 'Grade');
    await tile('cartão', 'Cartão');
    await key(page, 'Control+Shift+D', 2);
  });
  for (const [i, [a, b]] of ([['Degustação', '250 g por mês, um café por vez.'], ['Casa', '500 g por mês, dois cafés diferentes.'], ['Escritório', '1,5 kg por mês para a equipe.']] as const).entries()) {
    await t.step(`plano-${i + 1}`, async () => {
      await editText(page, 'Título do cartão', a);
      await editText(page, 'Uma descrição curta', b);
    });
  }
  await t.step('faq', async () => {
    await tile('seção', 'Seção');
    await tile('título', 'Título');
    await editText(page, 'Novo título', 'Dúvidas');
    await tile('sanfona', 'Sanfona');
  });
  await t.step('rodape', async () => {
    await tile('rodapé', 'Rodapé');
    await tile('parágrafo', 'Parágrafo');
    await editText(page, 'Um parágrafo', '© 2026 Grão Norte');
  });
  const d = await doc(page);
  const nodes = [...walk(firstTree(d))];
  const texts = nodes.map((n) => n.text ?? '').join(' ');
  const wanted = ['Grão Norte', 'Nossos cafés', 'Café de especialidade', 'Por que o Grão Norte', 'Origem rastreada', 'Torra fresca', 'Sem fidelidade', '“O melhor café', 'Planos de assinatura', 'Degustação', 'Casa', 'Escritório', 'Dúvidas', '© 2026 Grão Norte'];
  const missing = wanted.filter((w) => !texts.includes(w));
  t.note(`${nodes.length} elements; texts missing: ${missing.join(' | ') || 'none'}; ${Math.round((Date.now() - t0) / 1000)} s machine time; status "${await status(page)}"`);
  await shot(page, t.front, 'final-topo');
  await page.locator('[data-region="canvas-stage"]').hover();
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(300);
  await shot(page, t.front, 'final-meio');
  const r = await t.end(missing.length === 0 && t.deadEnds.length === 0 ? 'done' : 'partial', { elements: nodes.length, missing });
  expect(r.consoleErrors).toEqual([]);
});
