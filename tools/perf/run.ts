// Serial Chrome measurement runner. Recording never claims that an unmet product budget passed;
// --enforce turns the same report's declared target into a failing process exit for stage gates.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { CHANNEL } from '../runner/environment.ts';
import { budgetResult, summarize, type PerformanceRun } from './metrics.ts';

const settings = JSON.parse(fs.readFileSync('tests/perf/budget.json', 'utf8')) as { runs: number; historical: { p50: number; p95: number }; target: { p50: number; p95: number } };
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--runs' || args[index] === '--render') {
    index += 1;
    if (!args[index] || args[index]?.startsWith('--')) throw new Error('An option value is missing');
  }
  else if (args[index] !== '--enforce') throw new Error(`Unknown option ${args[index]}`);
}
const rendering = args.indexOf('--render');
const previous = rendering < 0 ? null : JSON.parse(fs.readFileSync(path.join(path.resolve(args[rendering + 1] as string), 'summary.json'), 'utf8')) as {
  generatedAt: string; commit: string; runs: number; environment: { platform: string; cpu?: string; parallelism: number; mode: string; viewport: { width: number; height: number }; trace: boolean; workers: number; chrome?: string };
  target: { p50: number; p95: number }; historical: { p50: number; p95: number };
};
const at = args.indexOf('--runs');
const runs = previous?.runs ?? (at < 0 ? settings.runs : Number(args[at + 1]));
if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw new Error('--runs must be an integer from 1 to 20');
const output = rendering >= 0 ? path.resolve(args[rendering + 1] as string) : path.resolve('.cache/logs', `perf-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const measured = previous ? { status: 0 } : spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/perf/playwright.config.ts'], {
  stdio: 'inherit', env: { ...process.env, PERF_OUTPUT: output, PERF_RUNS: String(runs) },
});
const records = fs.readdirSync(output).filter(file => /^run-\d+\.json$/.test(file)).map(file => JSON.parse(fs.readFileSync(path.join(output, file), 'utf8')) as PerformanceRun);
if (measured.status !== 0 || records.length !== runs) throw new Error(`Measurement incomplete: ${records.length}/${runs} runs; raw evidence: ${output}`);
const samples = records.flatMap(record => record.samples);
const target = previous?.target ?? settings.target;
const interaction = samples.filter(sample => !['Control', 'Alt', 'Shift', 'Meta'].includes(sample.key ?? ''));
const phases = [...new Set(interaction.map(sample => sample.phase))].map(phase => {
  const timing = summarize(interaction.filter(sample => sample.phase === phase).map(sample => sample.inputMs));
  return { phase, ...timing, budget: budgetResult(timing, target) };
});
const summary = {
  generatedAt: previous?.generatedAt ?? new Date().toISOString(), commit: previous?.commit ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environment: previous?.environment ?? { platform: process.platform, cpu: os.cpus()[0]?.model, parallelism: os.availableParallelism(), mode: 'production', viewport: { width: 1440, height: 900 }, trace: false, workers: 1 },
  runs, nodes: 641, opening: summarize(records.map(record => record.openingMs)),
  inputToSecondFrame: summarize(interaction.map(sample => sample.inputMs)),
  studyMethodOnThisRun: summarize(samples.map(sample => sample.handlerMs)), historical: previous?.historical ?? settings.historical,
  target, phases, withinBudget: phases.every(phase => phase.budget === 'within'),
  method: 'Trusted pointerdown and non-modifier keydown event timestamps to the second animation frame. Approximate rendering proxy, not physical screen presentation. The study-compatible column starts at the event handler and includes modifier keys. Native Event Timing is supplementary and excludes events below 16ms; it is not used to compute uncensored percentiles.',
  records,
};
const labels = JSON.parse(fs.readFileSync('src/i18n/locales/pt-BR.json', 'utf8')) as Record<string, string>;
const label = (name: string) => {
  const value = labels[`perf.${name}`];
  if (value === undefined) throw new Error(`Missing report label ${name}`);
  return value;
};
const html = (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
const tokens = pathToFileURL(path.resolve('src/ui/tokens.css')).href;
const report = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${tokens}"><title>${html(label('title'))}</title><style>
body{margin:0;padding:var(--space-10);background:var(--color-bg-app);color:var(--color-text);font-family:var(--font-ui)}main{max-width:calc(var(--size-palette) * 2);margin:auto}h1{font-size:calc(var(--fs-input) * 2)}p{line-height:var(--lh-body)}table{width:100%;border-collapse:collapse;background:var(--color-surface)}th,td{text-align:left;padding:var(--space-6);border-bottom:1px solid var(--color-border)}.summary{display:flex;gap:var(--space-10);margin:var(--space-10) 0}.metric{font-size:calc(var(--fs-input) * 2)}.muted{color:var(--color-text-muted)}img{display:block;width:100%;margin-top:var(--space-10);border:1px solid var(--color-border)}
</style></head><body><main><h1>${html(label('title'))}</h1><p>${html(label('scope'))} · ${runs} ${html(label('runs'))} · ${interaction.length} ${html(label('samples'))}</p>
<div class="summary"><div>${html(label('typical'))}<div class="metric">${number(summary.inputToSecondFrame.p50)} ms</div></div><div>${html(label('tail'))}<div class="metric">${number(summary.inputToSecondFrame.p95)} ms</div></div><div>${html(label('opening'))}<div class="metric">${number(summary.opening.p50)} ms</div></div></div>
<p><strong>${html(label(summary.withinBudget ? 'within' : 'exceeded'))}</strong> · ${html(label('target'))}: ${target.p50} / ${target.p95} ms</p>
<table><thead><tr><th>${html(label('action'))}</th><th>${html(label('samples'))}</th><th>${html(label('typical'))}</th><th>${html(label('tail'))}</th></tr></thead><tbody>${phases.map(phase => `<tr><td>${html(label(phase.phase))}</td><td>${phase.n}</td><td>${number(phase.p50)} ms</td><td>${number(phase.p95)} ms</td></tr>`).join('')}</tbody></table>
<p class="muted">${html(label('method'))}</p><p class="muted">${html(label('historical'))}: ${settings.historical.p50} / ${settings.historical.p95} ms. ${html(label('comparison'))}</p>
<p class="muted">${html(summary.commit.slice(0, 7))} · ${html(summary.generatedAt)} · ${html(summary.environment.cpu)}</p><img src="${html(records[0]?.screenshot ?? '')}" alt="${html(label('page'))}"></main></body></html>`;
fs.writeFileSync(path.join(output, 'report.html'), report);
const browser = await chromium.launch({ channel: CHANNEL });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, locale: 'en-US' });
  await page.goto(pathToFileURL(path.join(output, 'report.html')).href);
  await page.screenshot({ path: path.join(output, 'report.png'), fullPage: true });
  if (!previous) Object.assign(summary.environment, { chrome: browser.version() });
} finally { await browser.close(); }
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ output, runs, input: summary.inputToSecondFrame, opening: summary.opening, phases, withinBudget: summary.withinBudget }, null, 2));
if (args.includes('--enforce') && !summary.withinBudget) process.exitCode = 1;
