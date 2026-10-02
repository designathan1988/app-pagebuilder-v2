// The UI driver (the plan's "the development loop"): one command that drives the real app in Chrome with real gestures
// — a click, a drag, typing, a key — photographs every step into .cache/logs/ui-<flow>-<time>/, reads what happened
// through the read-only test port, and fails when the app logged an error, recorded an incident, or did not do what the
// flow says.
//
//   npm run ui -- <flow>          one of tools/ui/flows.ts
//   npm run ui -- --list          what can be run
//   npm run ui -- --door <id>     press one door by its manifest id, then photograph the result
//
// It never uses the editor's own preview pane: Playwright on the installed Chrome, as the user's order says. The port
// is the same one the dev server and the browser checks use (PORT).
import { chromium, type Browser, type ConsoleMessage, type Page } from '@playwright/test';
import { CHANNEL } from '../runner/environment.ts';
import fs from 'node:fs';
import path from 'node:path';
import { FLOWS, type Flow, type Step } from './flows.ts';

const args = process.argv.slice(2);
const port = process.env.PORT ?? '5320';
const base = `http://localhost:${port}/`;

interface Port {
  readonly document: () => { readonly pages: readonly { readonly tree: Node }[]; readonly files?: readonly { path: string }[] };
  readonly selection: () => readonly string[];
  readonly history: () => { readonly undoSteps: number; readonly redoSteps: number };
  readonly incidents: () => readonly { readonly kind: string; readonly what: string; readonly detail: string }[];
  readonly explain: { readonly command: (id: string, args: unknown) => string; readonly node: (id: string) => { readonly about: string; readonly answer: string } };
}
interface Node {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly children: readonly Node[];
  readonly text: string | null;
}

if (args.includes('--list') || args.length === 0) {
  console.log('flows:');
  for (const flow of FLOWS) console.log(`  ${flow.name.padEnd(14)} ${flow.about}`);
  console.log('\n  --door <id>    press one door by its manifest id');
  console.log(`\nthe port comes from PORT (now ${port}); start the app first (npm run dev, or npm run build && npm run preview)`);
  process.exit(args.length === 0 ? 1 : 0);
}

const stamp = new Date().toISOString().slice(11, 19).replaceAll(':', '');
const name = args.includes('--door') ? `door-${(args[args.indexOf('--door') + 1] ?? 'none').replaceAll(/[#/]/g, '-')}` : (args[0] ?? 'flow');
const shots = path.join('.cache', 'logs', `ui-${name}-${stamp}`);
fs.mkdirSync(shots, { recursive: true });

const problems: string[] = [];
// the downloads the page made, newest last
let downloads: import('@playwright/test').Download[] = [];
const consoleErrors: string[] = [];

// The app's own port, read-only, in the page: the same surface the browser checks use.
// the port's members are read inside the page: a function does not survive the trip to this process
const readSelection = (page: Page): Promise<readonly string[]> => page.evaluate(() => (window as unknown as { __builderTestPort: Port }).__builderTestPort.selection());
const readIncidents = (page: Page): Promise<readonly { kind: string; what: string; detail: string }[]> => page.evaluate(() => (window as unknown as { __builderTestPort: Port }).__builderTestPort.incidents());
const readDocument = (page: Page): Promise<{ pages: readonly { tree: Node }[]; files?: readonly { path: string }[] }> => page.evaluate(() => (window as unknown as { __builderTestPort: Port }).__builderTestPort.document());
const readWhy = (page: Page, id: string, args: unknown): Promise<string> => page.evaluate(([one, a]) => (window as unknown as { __builderTestPort: Port }).__builderTestPort.explain.command(one as string, a), [id, args] as const);

// (the count is computed in the page, where the tree lives)
function allNodesCount(node: Node | undefined): number {
  return node === undefined ? 0 : 1 + node.children.reduce((sum, child) => sum + allNodesCount(child), 0);
}

async function pointFor(page: Page, at: string | { readonly x: number; readonly y: number }): Promise<{ x: number; y: number }> {
  if (typeof at !== 'string') {
    const mapped = await page.evaluate((pagePoint) => {
      const iframe = document.querySelector<HTMLIFrameElement>('.frame__page');
      if (iframe === null) throw new Error('the canvas frame is missing');
      const zoom = iframe.currentCSSZoom;
      const box = iframe.getBoundingClientRect();
      const style = getComputedStyle(iframe);
      const left = box.left + (parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft)) * zoom;
      const top = box.top + (parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop)) * zoom;
      return { x: left + pagePoint.x * zoom, y: top + pagePoint.y * zoom };
    }, at);
    return mapped;
  }
  // a node's name, or a node id: the element the canvas draws for it, at its middle
  const mapped = await page.evaluate((wanted) => {
    const iframe = document.querySelector<HTMLIFrameElement>('.frame__page');
    const doc = iframe?.contentDocument ?? null;
    if (iframe === null || doc === null) throw new Error('the canvas frame is missing');
    const port = (window as unknown as { __builderTestPort: Port }).__builderTestPort;
    const tree = port.document().pages[0]?.tree;
    const named = tree === undefined ? [] : [tree, ...tree.children.flatMap(function walk(child: Node): readonly Node[] { return [child, ...child.children.flatMap(walk)]; })];
    const wanted2 = String(wanted).trim().toLowerCase();
    const found = named.find((node) => node.id === wanted || node.name.trim().toLowerCase() === wanted2);
    const el = found === undefined ? null : doc.querySelector(`[data-node="${found.id}"]`);
    if (el === null) throw new Error(`the canvas draws no ${wanted}`);
    const r = el.getBoundingClientRect();
    const zoom = iframe.currentCSSZoom;
    const box = iframe.getBoundingClientRect();
    const style = getComputedStyle(iframe);
    const left = box.left + (parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft)) * zoom;
    const top = box.top + (parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop)) * zoom;
    return { x: left + (r.left + r.width / 2) * zoom, y: top + (r.top + r.height / 2) * zoom };
  }, at);
  return mapped;
}

async function runStep(page: Page, step: Step): Promise<string> {
  const label = 'photo' in step ? step.photo : Object.keys(step)[0] ?? 'step';
  if ('door' in step) {
    const selector = `[data-door="${step.door}"]`;
    const control = step.labelled === undefined ? page.locator(selector).first() : page.locator(selector, { hasText: step.labelled }).first();
    await control.waitFor({ state: 'visible', timeout: 5_000 });
    await control.click();
  } else if ('click' in step) {
    await page.locator(step.click).first().click();
  } else if ('type' in step) {
    const field = page.locator(step.type.at).first();
    await field.waitFor({ state: 'visible', timeout: 5_000 });
    await field.click();
    if (step.type.clear !== false) await page.keyboard.press('Control+a');
    await page.keyboard.type(step.type.text);
    if (step.type.enter !== false) await page.keyboard.press('Enter');
  } else if ('key' in step) {
    await page.keyboard.press(step.key);
  } else if ('text' in step) {
    await page.keyboard.type(step.text);
  } else if ('reload' in step) {
    const accept = (dialog: import('@playwright/test').Dialog) => { void dialog.accept(); };
    page.on('dialog', accept);
    await page.reload();
    await page.locator('.workbench').waitFor();
    page.off('dialog', accept);
  } else if ('files' in step) {
    const chooser = page.waitForEvent('filechooser');
    await page.locator(step.files.at).first().click();
    await (await chooser).setFiles([...step.files.paths]);
  } else if ('move' in step) {
    const box = await page.locator(step.move.at).first().boundingBox();
    if (box === null) throw new Error(`the pointer target is not drawn: ${step.move.at}`);
    const { from, to, steps, interval } = step.move;
    await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
    for (let i = 1; i <= steps; i += 1) {
      await page.waitForTimeout(interval);
      await page.mouse.move(box.x + box.width * (from[0] + (to[0] - from[0]) * i / steps), box.y + box.height * (from[1] + (to[1] - from[1]) * i / steps));
    }
  } else if ('drag' in step) {
    const from = await pointFor(page, step.drag.from);
    const to = await pointFor(page, step.drag.to);
    if (step.drag.modifier !== undefined) await page.keyboard.down(step.drag.modifier);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y + 10, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    if (step.drag.modifier !== undefined) await page.keyboard.up(step.drag.modifier);
  } else if ('stroke' in step) {
    const box = await page.locator(step.stroke.at).first().boundingBox();
    if (box === null) throw new Error(`the stroke's surface is not drawn: ${step.stroke.at}`);
    const at = ([fx, fy]: readonly [number, number]) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
    const [first, ...rest] = step.stroke.points.map(at);
    if (first === undefined) throw new Error('a stroke needs points');
    if (step.stroke.modifier !== undefined) await page.keyboard.down(step.stroke.modifier);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const point of rest) await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.mouse.up();
    if (step.stroke.modifier !== undefined) await page.keyboard.up(step.stroke.modifier);
  } else if ('wheel' in step) {
    const box = await page.locator(step.wheel.at).first().boundingBox();
    if (box === null) throw new Error(`the wheel's target is not drawn: ${step.wheel.at}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, step.wheel.dy);
  } else if ('wait' in step) {
    await page.waitForTimeout(step.wait ?? 200);
  }
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return label;
}

async function check(page: Page, step: Step, index: number): Promise<void> {
  if (!('expect' in step)) return;
  const selection = await readSelection(page);
  const document = await readDocument(page);
  const tree = document.pages[0]?.tree;
  const nodes = allNodesCount(tree);
  const message = await page.locator('[data-region="status-bar"]').innerText().catch(() => '');
  const expected = step.expect;
  if (expected.selection !== undefined && JSON.stringify(selection) !== JSON.stringify(expected.selection)) {
    problems.push(`step ${index}: the selection is ${JSON.stringify(selection)}, expected ${JSON.stringify(expected.selection)}`);
  }
  if (expected.selectedCount !== undefined && selection.length !== expected.selectedCount) {
    problems.push(`step ${index}: ${selection.length} selected, expected ${expected.selectedCount}`);
  }
  if (expected.nodes !== undefined && nodes !== expected.nodes) problems.push(`step ${index}: the page holds ${nodes} elements, expected ${expected.nodes}`);
  if (expected.message !== undefined && expected.message !== '' && !message.includes(expected.message)) {
    problems.push(`step ${index}: the status bar says ${JSON.stringify(message.split('\n')[0])}, expected it to contain ${JSON.stringify(expected.message)}`);
  }
  if (expected.files !== undefined) {
    const files = (document.files ?? []).map((file) => file.path);
    if (JSON.stringify(files) !== JSON.stringify(expected.files)) problems.push(`step ${index}: the project holds ${JSON.stringify(files)}, expected ${JSON.stringify(expected.files)}`);
  }
  if (expected.exportedFiles !== undefined) {
    const exported = await exportedFiles();
    for (const wanted of expected.exportedFiles) if (!exported.includes(wanted)) problems.push(`step ${index}: the export has no ${wanted} (it has ${exported.join(', ')})`);
  }
}

// The files the last download held: the driver lets Playwright keep it and reads the ZIP's index.
async function exportedFiles(): Promise<readonly string[]> {
  const download = downloads.at(-1);
  if (download === undefined) return [];
  const at = await download.path();
  if (at === null) return [];
  const { unzip } = await import('../runner/unzip.ts');
  return [...unzip(fs.readFileSync(at)).keys()];
}

async function runFlow(browser: Browser, flow: Flow): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  // the export downloads: kept as they arrive, so a step's expectation can read the last one
  downloads = [];
  page.on('download', (download) => downloads.push(download));
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => consoleErrors.push(`page error: ${String(error).slice(0, 300)}`));
  await page.goto(base);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('.workbench').waitFor();
  console.log(`\nflow "${flow.name}": ${flow.about}`);
  let index = 0;
  let told = false;
  for (const step of flow.steps) {
    index += 1;
    const label = await runStep(page, step);
    await check(page, step, index);
    const photo = path.join(shots, `${String(index).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path: photo });
    const incidents = await readIncidents(page);
    const first = (await page.locator('[data-region="status-bar"]').innerText().then((text) => text.split('\n')[0]).catch(() => '')) ?? '';
    console.log(`  ${String(index).padStart(2, '0')} ${label.padEnd(18)} ${first.slice(0, 60)}${incidents.length > 0 ? `  [${incidents.length} incident(s)]` : ''}`);
    // the first incident is told where it happened, whole: a later step that fails because of it hides the cause
    if (incidents.length > 0 && !told) {
      told = true;
      for (const one of incidents) console.log(`     incident (${one.kind}): ${one.what} — ${one.detail.split(String.fromCharCode(10)).slice(0, 3).join(' | ')}`);
    }
  }
  const incidents = await readIncidents(page);
  if (incidents.length > 0) for (const one of incidents) problems.push(`incident (${one.kind}): ${one.what} — ${one.detail.split('\n')[0] ?? ''}`);
  await context.close();
}

async function runDoor(browser: Browser, door: string): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => consoleErrors.push(`page error: ${String(error).slice(0, 300)}`));
  await page.goto(base);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('.workbench').waitFor();
  const why = await readWhy(page, door, {});
  console.log(`\ndoor "${door}": ${why === 'accepted' ? 'it would run' : `it would not run: ${why}`}`);
  const control = page.locator(`[data-door="${door}"]`).first();
  const drawn = (await control.count()) > 0;
  console.log(`  drawn: ${drawn ? 'yes' : 'no (the door is not on any screen now)'}`);
  if (drawn) {
    await control.click();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: path.join(shots, `door.png`) });
    const now = await page.locator('[data-region="status-bar"]').innerText().then((text) => text.split('\n')[0]).catch(() => '');
    console.log(`  after the press the status bar says: ${now}`);
  }
  const incidents = await readIncidents(page);
  if (incidents.length > 0) problems.push(...incidents.map((one) => `incident (${one.kind}): ${one.what}`));
  await context.close();
}

const browser = await chromium.launch({ channel: CHANNEL });
if (args.includes('--door')) {
  await runDoor(browser, args[args.indexOf('--door') + 1] ?? '');
} else {
  const flow = FLOWS.find((one) => one.name === args[0]);
  if (flow === undefined) {
    console.error(`no flow named "${args[0] ?? ''}": run npm run ui -- --list`);
    process.exit(1);
  }
  await runFlow(browser, flow);
}
await browser.close();

for (const error of consoleErrors) problems.push(`console error: ${error}`);
console.log(`\nphotos: ${shots}`);
if (problems.length === 0) {
  console.log('the flow ran clean: no incident, no console error, every expectation met.');
  process.exit(0);
}
console.error(`\n${problems.length} problem(s):`);
for (const problem of problems) console.error(`  - ${problem}`);
process.exit(1);
