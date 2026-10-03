// The study's probes P2, P3 and P4 (jornada03): the keyboard reaching every region (F6), the canvas share at 1280 x 720
// (H17: at least 50 %), and a long history (50 edits undone and redone exactly).
import { test, expect } from '../../../tests/support/test.ts';
import { Task, open, doc, history, shot, walk, firstTree } from '../kit.ts';
import { insert, field, pick } from '../ui.ts';

test('P3 small screen 1280 x 720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  const t = new Task(page, 'P3');
  await shot(page, t.front, 'editor-1280x720');
  const measure = await page.evaluate(() => {
    const stage = document.querySelector('[data-region="canvas-stage"]')?.getBoundingClientRect();
    const frame = document.querySelector('[data-region="canvas-frame"]')?.getBoundingClientRect();
    const clipped = [...document.querySelectorAll<HTMLElement>('[data-region]')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
    }).map((e) => e.getAttribute('data-region'));
    const overflow = [...document.querySelectorAll<HTMLElement>('[data-region="canvas-toolbar"], [data-region="top-bar"], [data-region="status-bar"]')].map((e) => ({ region: e.getAttribute('data-region'), scroll: e.scrollWidth, client: e.clientWidth }));
    const toolbar = document.querySelector('[data-region="canvas-toolbar"]')?.getBoundingClientRect();
    const centre = toolbar && stage ? { w: stage.width, h: stage.bottom - toolbar.top } : null;
    return { centre, stage: stage ? { w: stage.width, h: stage.height } : null, frame: frame ? { w: frame.width, h: frame.height } : null, window: { w: innerWidth, h: innerHeight }, clipped, overflow };
  });
  const share = measure.stage ? (measure.stage.w * measure.stage.h) / (measure.window.w * measure.window.h) : 0;
  const centreShare = measure.centre ? (measure.centre.w * measure.centre.h) / (measure.window.w * measure.window.h) : 0;
  t.note(`centre column (toolbar to stage bottom) ${JSON.stringify(measure.centre)}: ${(centreShare * 100).toFixed(1)} % of the window; width share ${measure.stage ? ((measure.stage.w / measure.window.w) * 100).toFixed(1) : '?'} %`);
  t.note(`canvas stage ${JSON.stringify(measure.stage)} of window ${JSON.stringify(measure.window)}: ${(share * 100).toFixed(1)} %; clipped regions: ${measure.clipped.join(', ') || 'none'}; overflow ${JSON.stringify(measure.overflow)}`);
  await t.end(share >= 0.5 ? 'done' : 'partial', { share, ...measure });
});

test('P2 keyboard reaches every region with F6', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'P2');
  const seen: string[] = [];
  await page.locator('[data-region="canvas-stage"]').click({ position: { x: 20, y: 20 } }).catch(() => undefined);
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('F6');
    await page.waitForTimeout(120);
    const where = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      const region = a?.closest('[data-region]')?.getAttribute('data-region') ?? a?.localName ?? 'none';
      const ring = a ? getComputedStyle(a).outlineStyle + ' ' + getComputedStyle(a).outlineWidth : '';
      return `${region} (${a?.localName}${a?.getAttribute('aria-label') ? ' ' + a.getAttribute('aria-label') : ''}; outline ${ring})`;
    });
    seen.push(where);
    if (i < 8) await shot(page, t.front, `f6-${i + 1}`);
  }
  t.note(`F6 walk: ${seen.join(' → ')}`);
  const regions = new Set(seen.map((s) => s.split(' ')[0]));
  for (const wanted of ['canvas-stage', 'layers-tree']) if (![...regions].some((r) => r?.startsWith(wanted.split('-')[0] ?? wanted))) t.deadEnd(`F6 never reached ${wanted}`);
  await t.end(t.deadEnds.length === 0 ? 'done' : 'partial', { walk: seen });
});

test('P4 long history: 50 edits, undo all, redo all', async ({ page }) => {
  await open(page);
  const t = new Task(page, 'P4');
  await insert(page, 'heading', 'Heading');
  const sizes: number[] = [];
  for (let i = 0; i < 50; i += 1) sizes.push(12 + i);
  const before = await doc(page);
  const t0 = Date.now();
  for (const size of sizes) await field(page, 'style.set#inspector-font-size', String(size));
  const edit = Date.now() - t0;
  const after = await doc(page);
  await shot(page, t.front, 'depois-de-50-edicoes');
  const steps = (await history(page)).undoSteps;
  await page.locator('[data-region="canvas-stage"]').click({ position: { x: 10, y: 10 } });
  const u0 = Date.now();
  for (let i = 0; i < steps; i += 1) await page.keyboard.press('Control+Z');
  await page.waitForTimeout(300);
  const undone = Date.now() - u0;
  const back = await doc(page);
  await shot(page, t.front, 'tudo-desfeito');
  const r0 = Date.now();
  for (let i = 0; i < steps; i += 1) await page.keyboard.press('Control+Shift+Z');
  await page.waitForTimeout(300);
  const redone = Date.now() - r0;
  const again = await doc(page);
  await shot(page, t.front, 'tudo-refeito');
  const emptyMatches = JSON.stringify(back.pages) === JSON.stringify(before.pages) || [...walk(firstTree(back))].length === 1;
  if (!emptyMatches) t.deadEnd('undo of everything did not return to the start');
  if (JSON.stringify(again.pages) !== JSON.stringify(after.pages)) t.deadEnd('redo of everything did not return to the end');
  t.note(`undo steps ${steps}; edit ${edit} ms total; undo ${undone} ms (${(undone / Math.max(1, steps)).toFixed(1)} ms/step); redo ${redone} ms`);
  await t.end(t.deadEnds.length === 0 ? 'done' : 'partial', { steps, editMs: edit, undoMs: undone, redoMs: redone });
  expect(steps).toBeGreaterThan(0);
  void pick;
});
