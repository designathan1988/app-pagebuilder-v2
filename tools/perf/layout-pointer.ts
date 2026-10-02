// The Layout Composer's pointer budget (spec layout-composer; .memory/layout-composer-spec.md "16 ms"): while a stroke
// is held over a composition of fifteen regions, every pointer move's synchronous work — the pointer owner, the
// composer's reading of the stroke and the preview it publishes — and the frames the canvas draws are measured in the
// installed Chrome against the running app (PORT). The report goes to .cache/logs/perf-layout-<time>.json; the process
// fails when the 95th percentile of a move's work is over the budget.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { CHANNEL } from '../runner/environment.ts';

const BUDGET_MS = 16;
const MOVES = 240;
const port = process.env.PORT ?? '5320';

const percentile = (values: readonly number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};
const round = (n: number): number => Math.round(n * 100) / 100;

const browser = await chromium.launch({ channel: CHANNEL });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
// the first listener of every pointer move (before the app's own) marks its start; the last one, added once the app
// has installed its listeners, marks the end of its synchronous work
await page.addInitScript(() => {
  const marks: number[] = [];
  (window as unknown as { __moveStarts: number[] }).__moveStarts = marks;
  window.addEventListener('pointermove', () => marks.push(performance.now()), true);
});
await page.goto(`http://localhost:${port}/`);
await page.evaluate(() => window.localStorage.clear());
await page.reload();
await page.locator('.workbench').waitFor();
await page.locator('[data-door="workspace.setPanelOpen#toolbar-activity-bar-layout-composer"]').click();
await page.locator('[data-door="layout.enter#layout-compose"]').click();
// a composition of fifteen regions: the dashboard (seven) and the gallery (eight) placed inside its chart
await page.locator(`[data-door="layout.template#layout-template"][data-args='{"template":"dashboard"}']`).click();
await page.locator('[data-layout-region="r6"]').click();
await page.locator(`[data-door="layout.template#layout-template"][data-args='{"template":"gallery"}']`).click();
const stage = page.locator('[data-layout-stage]');
const box = await stage.boundingBox();
if (box === null) throw new Error('the Layout Composer stage is not drawn');
await page.evaluate(() => {
  const ends: number[] = [];
  (window as unknown as { __moveEnds: number[] }).__moveEnds = ends;
  window.addEventListener('pointermove', () => ends.push(performance.now()));
  const frames: number[] = [];
  (window as unknown as { __frames: number[] }).__frames = frames;
  const tick = (at: number) => {
    frames.push(at);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const regions = await page.locator('[data-layout-region]').count();
// a long stroke across the whole composition, as a person draws a cut or a merge: the preview reads it at every move
const from = { x: box.x + box.width * 0.02, y: box.y + box.height * 0.5 };
await page.evaluate(() => {
  (window as unknown as { __moveStarts: number[] }).__moveStarts.length = 0;
  (window as unknown as { __moveEnds: number[] }).__moveEnds.length = 0;
  (window as unknown as { __frames: number[] }).__frames.length = 0;
});
await page.mouse.move(from.x, from.y);
await page.mouse.down();
for (let i = 1; i <= MOVES; i += 1) await page.mouse.move(from.x + ((box.width * 0.96) * i) / MOVES, from.y + Math.sin(i / 12) * 40);
await page.mouse.up();
const measured = await page.evaluate(() => {
  const w = window as unknown as { __moveStarts: number[]; __moveEnds: number[]; __frames: number[] };
  return { starts: w.__moveStarts, ends: w.__moveEnds, frames: w.__frames };
});
await browser.close();

const work = measured.starts.map((start, i) => (measured.ends[i] ?? start) - start).filter((ms) => ms >= 0);
const frames = measured.frames.slice(1).map((at, i) => at - (measured.frames[i] ?? at));
const report = {
  generatedAt: new Date().toISOString(),
  budgetMs: BUDGET_MS,
  regions,
  moves: work.length,
  moveWorkMs: { p50: round(percentile(work, 50)), p95: round(percentile(work, 95)), max: round(Math.max(...work)) },
  frameIntervalMs: { p50: round(percentile(frames, 50)), p95: round(percentile(frames, 95)), max: round(Math.max(...frames)) },
  within: percentile(work, 95) <= BUDGET_MS,
};
const out = path.resolve('.cache/logs', `perf-layout-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify({ ...report, samples: { work, frames } }, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`report: ${out}`);
if (!report.within) {
  console.log(`a pointer move's work is over the ${String(BUDGET_MS)} ms budget at the 95th percentile`);
  process.exit(1);
}
