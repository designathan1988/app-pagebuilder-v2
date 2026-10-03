// The audit's journey kit: photos numbered per front, the in-page probe of the jornada03 study (input → second frame
// latency, the status bar's messages, console errors), and the record of a task.
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export const FOTOS = '.cache/logs/journey/photos';
export const RECORDS = '.cache/logs/journey/records';
fs.mkdirSync(RECORDS, { recursive: true });

const counters = new Map<string, number>();
export async function shot(page: Page, front: string, label: string, full = false): Promise<string> {
  const n = (counters.get(front) ?? 0) + 1;
  counters.set(front, n);
  const dir = path.join(FOTOS, front);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(n).padStart(2, '0')}-${label.replace(/[^a-z0-9-]+/gi, '-').slice(0, 60)}.png`);
  await page.screenshot({ path: file, fullPage: full });
  return file;
}

// the study's probe (jornada03/scripts/driver.mjs PROBE), unchanged in what it measures
export const PROBE = (): void => {
  const top = (window.top ?? window) as unknown as Window & { __audit?: { latency: { kind: string; ms: number }[]; messages: { t: number; text: string }[]; errors: string[] } };
  if (!top.__audit) top.__audit = { latency: [], messages: [], errors: [] };
  const log = top.__audit;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const sample = async (kind: string) => {
    const t0 = performance.now();
    await frame();
    log.latency.push({ kind, ms: Math.round((performance.now() - t0) * 10) / 10 });
  };
  addEventListener('pointerdown', () => void sample('pointer'), true);
  addEventListener('keydown', () => void sample('key'), true);
  const err = console.error.bind(console);
  console.error = (...a: unknown[]) => {
    log.errors.push(a.map(String).join(' ').slice(0, 300));
    err(...a);
  };
  addEventListener('error', (e) => log.errors.push(String(e.message).slice(0, 300)));
  if (window === top) {
    const watch = () => {
      const bar = document.querySelector('.status-bar__message');
      if (!bar) return void setTimeout(watch, 300);
      let last = '';
      new MutationObserver(() => {
        const text = bar.textContent ?? '';
        if (text !== last) log.messages.push({ t: Math.round(performance.now()), text: (last = text) });
      }).observe(bar, { childList: true, characterData: true, subtree: true });
    };
    addEventListener('DOMContentLoaded', watch);
  }
};

export async function open(page: Page, options: { locale?: string } = {}): Promise<void> {
  await page.addInitScript(PROBE);
  await page.goto('/');
  await page.locator('.workbench').waitFor();
  void options;
}

export const status = (page: Page): Promise<string> => page.locator('.status-bar__message').innerText({ timeout: 1500 }).catch(() => '');
export interface Doc {
  readonly pages: { file: string; name: string; tree: Node }[];
  readonly classes?: { name: string }[];
  readonly tokens?: { name: string; value: string }[];
  readonly components?: { name: string }[];
  readonly files?: { path: string }[];
  readonly collections?: { name: string; items: unknown[] }[];
}
export const doc = (page: Page): Promise<Doc> =>
  page.evaluate(() => (window as unknown as { __builderTestPort: { document: () => never } }).__builderTestPort.document());
export interface Node { id: string; name: string; type: string; tag?: string; text?: string | null; children: Node[]; classes: string[]; styles?: Record<string, unknown>; attributes?: Record<string, unknown> }
export const history = (page: Page): Promise<{ undoSteps: number; redoSteps: number }> => page.evaluate(() => (window as unknown as { __builderTestPort: { history: () => never } }).__builderTestPort.history());
export const incidents = (page: Page): Promise<{ kind: string; what: string; detail: string }[]> => page.evaluate(() => (window as unknown as { __builderTestPort: { incidents: () => never } }).__builderTestPort.incidents());
export const selection = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __builderTestPort: { selection: () => never } }).__builderTestPort.selection());

// the first page's root, which every document has
export function firstTree(document: Pick<Doc, 'pages'>): Node {
  const tree = document.pages[0]?.tree;
  if (tree === undefined) throw new Error('the document has no page');
  return tree;
}

export function* walk(node: Node): Generator<Node> {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

// the screen point of the first page element whose own text starts with `text` (the canvas iframe, its zoom)
export async function canvasPoint(page: Page, text: string, n = 1): Promise<{ x: number; y: number } | null> {
  return page.evaluate(([wanted, index]) => {
    const f = document.querySelector<HTMLIFrameElement>('.frame__page');
    const d = f?.contentDocument;
    if (!f || !d) return null;
    const z = (f as unknown as { currentCSSZoom?: number }).currentCSSZoom || 1;
    const fr = f.getBoundingClientRect();
    const els = [...d.querySelectorAll<HTMLElement>('[data-node]')].filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? '').trim().startsWith(wanted as string)));
    const e = els[(index as number) - 1];
    if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return { x: fr.left + (r.left + Math.min(10, r.width / 2)) * z, y: fr.top + (r.top + r.height / 2) * z };
  }, [text, n] as const);
}
// the screen point of a node by its id
export async function nodePoint(page: Page, id: string): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return page.evaluate((nodeId) => {
    const f = document.querySelector<HTMLIFrameElement>('.frame__page');
    const d = f?.contentDocument;
    const e = d?.querySelector<HTMLElement>(`[data-node="${nodeId}"]`);
    if (!f || !e) return null;
    e.scrollIntoView({ block: 'center' });
    const z = (f as unknown as { currentCSSZoom?: number }).currentCSSZoom || 1;
    const fr = f.getBoundingClientRect();
    const r = e.getBoundingClientRect();
    return { x: fr.left + (r.left + Math.min(12, r.width / 2)) * z, y: fr.top + (r.top + Math.min(12, r.height / 2)) * z, w: r.width * z, h: r.height * z };
  }, id);
}

export interface TaskRecord {
  id: string;
  result: 'done' | 'partial' | 'abandoned';
  seconds: number;
  steps: number;
  deadEnds: string[];
  notes: string[];
  latency: { n: number; p50: number | null; p95: number | null; max: number | null };
  messages: string[];
  refusals: string[];
  consoleErrors: string[];
  incidents: number;
  undoSteps?: number;
  extra?: Record<string, unknown>;
}
const REFUSAL = /refused|recusad|cannot|não pode|nothing matches|nada corresponde|not available|não disponível|já existe|already exists|was not applied|não foi aplicad|failed|falhou/i;
export class Task {
  readonly start = Date.now();
  readonly deadEnds: string[] = [];
  readonly notes: string[] = [];
  steps = 0;
  constructor(readonly page: Page, readonly id: string, readonly front = `journey-${id}`) { }
  async step(label: string, run: () => Promise<unknown>): Promise<void> {
    this.steps += 1;
    try {
      await run();
    } catch (error) {
      this.deadEnds.push(`${label}: ${String(error).split('\n')[0]?.slice(0, 240)}`);
    }
    await this.page.waitForTimeout(150);
    await shot(this.page, this.front, label);
  }
  deadEnd(why: string): void { this.deadEnds.push(why); }
  note(text: string): void { this.notes.push(text); }
  async end(result: TaskRecord['result'], extra: Record<string, unknown> = {}): Promise<TaskRecord> {
    type Probe = { latency: { ms: number }[]; messages: { text: string }[]; errors: string[] };
    const probe = await this.page.evaluate(() => (window as unknown as { __audit?: Probe }).__audit ?? { latency: [], messages: [], errors: [] }).catch(() => ({ latency: [], messages: [], errors: [] }));
    const lat = probe.latency.map((l) => l.ms).sort((a, b) => a - b);
    const pct = (p: number) => (lat.length ? (lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))] ?? null) : null);
    const record: TaskRecord = {
      id: this.id,
      result,
      seconds: Math.round((Date.now() - this.start) / 1000),
      steps: this.steps,
      deadEnds: this.deadEnds,
      notes: this.notes,
      latency: { n: lat.length, p50: pct(50), p95: pct(95), max: lat.at(-1) ?? null },
      messages: probe.messages.map((m) => m.text),
      refusals: probe.messages.map((m) => m.text).filter((t) => REFUSAL.test(t)),
      consoleErrors: probe.errors,
      incidents: (await incidents(this.page).catch(() => [])).length,
      undoSteps: (await history(this.page).catch(() => ({ undoSteps: -1 }))).undoSteps,
      extra,
    };
    fs.writeFileSync(path.join(RECORDS, `${this.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
    return record;
  }
}
