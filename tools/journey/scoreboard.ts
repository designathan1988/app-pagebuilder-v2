// The task meter's scoreboard (STG-0.3): the records the journeys wrote (.cache/logs/journey/records), each task's
// result, time, steps, dead ends, refusals, incidents and latency, and the study's hypotheses H1–H17 read from them —
// a number where a task measures it, else what measures it (the performance gate for H16). The subjective scores of
// the study (SEQ, SUS) are an evaluator's, never a script's: they are not printed.
//   node tools/journey/scoreboard.ts
import fs from 'node:fs';
import path from 'node:path';

export const RECORDS = path.join('.cache', 'logs', 'journey', 'records');
interface TaskRecord {
  readonly id: string;
  readonly result: 'done' | 'partial' | 'abandoned';
  readonly seconds: number;
  readonly steps: number;
  readonly deadEnds: readonly string[];
  readonly refusals: readonly string[];
  readonly incidents: number;
  readonly latency: { readonly p50: number | null; readonly p95: number | null };
  readonly extra?: Record<string, unknown>;
}
interface Fidelity {
  readonly width: number;
  readonly pixelMatchCommon: number;
  readonly pixelMatchAdjusted: number;
}

const records = new Map<string, TaskRecord>(
  (fs.existsSync(RECORDS) ? fs.readdirSync(RECORDS) : [])
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(fs.readFileSync(path.join(RECORDS, file), 'utf8')) as TaskRecord)
    .map((record) => [record.id, record]),
);
const task = (id: string) => records.get(id);
const minutes = (record: TaskRecord | undefined) => (record === undefined ? null : Math.round((record.seconds / 60) * 10) / 10);
const done = (record: TaskRecord | undefined, limit: number | null = null) => {
  if (record === undefined) return { verdict: 'not run', evidence: '' };
  const inTime = limit === null || record.seconds <= limit * 60;
  const verdict = record.result === 'done' && inTime ? 'holds' : record.result === 'abandoned' ? 'refuted' : 'partial';
  return { verdict, evidence: `${record.result}, ${minutes(record)} min, ${record.deadEnds.length} dead ends, ${record.incidents} incidents` };
};
// the fidelity of Marina's saved project as exported now (H2), and of her tablet and phone work redone with the editor
// as it is (M3R, H3), else the saved project's
const saved = (task('H2-H3')?.extra?.fidelity as readonly Fidelity[] | undefined) ?? [];
const redone = (task('M3R')?.extra?.fidelity as readonly Fidelity[] | undefined) ?? saved;
const at = (width: number, list: readonly Fidelity[] = saved) => list.find((one) => one.width === width);
const share = (width: number, list: readonly Fidelity[] = saved) => at(width, list)?.pixelMatchCommon ?? null;

const hypotheses: { readonly id: string; readonly words: string; readonly verdict: string; readonly evidence: string }[] = [
  (() => {
    const m1 = task('M1');
    const verdict = m1 === undefined ? 'not run' : m1.result === 'done' && m1.seconds <= 300 && m1.deadEnds.length <= 1 ? 'holds' : 'refuted';
    return { id: 'H1', words: 'Newcomer reaches title, text, button ≤ 5 min, ≤ 1 dead end', verdict, evidence: done(m1).evidence };
  })(),
  (() => {
    const desktop = share(1440);
    const verdict = desktop === null ? 'not run' : desktop >= 85 ? 'holds' : 'refuted';
    return { id: 'H2', words: 'Desktop rebuild ≥ 85 % fidelity', verdict, evidence: desktop === null ? '' : `${desktop} % common, ${at(1440)?.pixelMatchAdjusted} % adjusted at 1440; the scripted rebuild (M2): ${done(task('M2')).evidence}` };
  })(),
  (() => {
    const [tablet, phone] = [share(834, redone), share(390, redone)];
    const verdict = tablet === null || phone === null ? 'not run' : tablet >= 80 && phone >= 80 ? 'holds' : 'refuted';
    return { id: 'H3', words: 'Tablet and phone ≥ 80 % at 834 and 390', verdict, evidence: tablet === null ? '' : `${tablet} % at 834, ${phone} % at 390 (common); ${at(834, redone)?.pixelMatchAdjusted} / ${at(390, redone)?.pixelMatchAdjusted} % adjusted; ${task('M3R') === undefined ? 'the saved project' : `M3 redone: ${done(task('M3R'), 15).evidence}`}` };
  })(),
  { id: 'H4', words: 'Own font and images without leaving the app ≤ 8 min', ...done(task('M4'), 8) },
  { id: 'H5', words: 'Client-ready preview and export in 1 min', ...done(task('M5'), 1) },
  { id: 'H6', words: 'Colours and spacing named once, reused', ...done(task('D1')) },
  { id: 'H7', words: 'Component ×6 changes everywhere from one edit', ...done(task('D2')) },
  { id: 'H8', words: 'Existing HTML imported and editable', ...done(task('D3')) },
  { id: 'H9', words: 'A page from the keyboard alone', ...done(task('D4')) },
  { id: 'H10', words: 'Export a developer accepts (CSS ≤ 2× hand-written)', verdict: 'not replayed', evidence: 'measured on the export by src/core/export (QA 51, 163) and html-validate (src/core/export/validity.test.ts)' },
  { id: 'H11', words: 'Brand colour across the site in ≤ 3 actions', ...done(task('C1')) },
  { id: 'H12', words: 'Pages from a page ≤ 1 min each', ...done(task('C2')) },
  { id: 'H13', words: 'Menu changes once for every page', ...done(task('C3')) },
  { id: 'H14', words: '12-item catalogue from a spreadsheet ≤ 5 min', ...done(task('C4'), 5) },
  { id: 'H15', words: 'No work lost on reload', ...done(task('C5')) },
  { id: 'H16', words: 'p95 ≤ 100 ms with 300+ elements', verdict: 'not replayed', evidence: 'npm run perf -- --enforce (641 nodes)' },
  { id: 'H17', words: 'Canvas ≥ 50 % at 1280 × 720', ...done(task('P3')) },
];

const lines = [
  'Times are those of the scripted replay, never of a person: a bound in minutes holds for the script, not for the personas of the study.',
  '',
  '| Task | Result | Minutes | Steps | Dead ends | Refusals | Incidents | p50 / p95 ms |',
  '|---|---|---|---|---|---|---|---|',
  ...[...records.values()].sort((a, b) => a.id.localeCompare(b.id)).map((r) => `| ${r.id} | ${r.result} | ${minutes(r)} | ${r.steps} | ${r.deadEnds.length} | ${r.refusals.length} | ${r.incidents} | ${r.latency.p50 ?? '–'} / ${r.latency.p95 ?? '–'} |`),
  '',
  '| Hypothesis | Words | Verdict | Evidence |',
  '|---|---|---|---|',
  ...hypotheses.map((h) => `| ${h.id} | ${h.words} | ${h.verdict} | ${h.evidence} |`),
];
console.log(lines.join('\n'));
fs.mkdirSync(path.dirname(RECORDS), { recursive: true });
fs.writeFileSync(path.join(path.dirname(RECORDS), 'scoreboard.json'), `${JSON.stringify({ tasks: [...records.values()], hypotheses }, null, 2)}\n`);
