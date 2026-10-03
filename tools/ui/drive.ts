// The UI driver (the plan's "the development loop"): one command that drives the real app in Chrome with real gestures
// — a click, a drag, typing, a key — photographs every step into .cache/logs/ui-<flow>-<time>/, reads what happened
// through the read-only test port, and fails when the app logged an error, recorded an incident, or did not do what the
// flow says. The flow is played by tools/ui/play.ts, which the browser suite also plays every flow with
// (tests/e2e/flows.spec.ts).
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
import { FLOWS, type Flow } from './flows.ts';
import { playFlow, readIncidents, readWhy } from './play.ts';

const args = process.argv.slice(2);
const port = process.env.PORT ?? '5320';
const base = `http://localhost:${port}/`;

if (args.includes('--list') || args.length === 0) {
  console.log('flows:');
  for (const flow of FLOWS) console.log(`  ${flow.name.padEnd(14)} ${flow.about}`);
  console.log('\n  --door <id>    press one door by its manifest id');
  console.log(`\nthe port comes from PORT (now ${port}); start the app first (npm run dev, or npm run build:e2e && npm run preview: the test port is only in those)`);
  process.exit(args.length === 0 ? 1 : 0);
}

const stamp = new Date().toISOString().slice(11, 19).replaceAll(':', '');
const name = args.includes('--door') ? `door-${(args[args.indexOf('--door') + 1] ?? 'none').replaceAll(/[#/]/g, '-')}` : (args[0] ?? 'flow');
const shots = path.join('.cache', 'logs', `ui-${name}-${stamp}`);
fs.mkdirSync(shots, { recursive: true });

const problems: string[] = [];

// a fresh profile's editor: the app opened, its storage cleared, opened again
async function openFresh(browser: Browser): Promise<{ readonly page: Page; readonly close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('.workbench').waitFor();
  return { page, close: () => context.close() };
}

async function runFlow(browser: Browser, flow: Flow): Promise<void> {
  const { page, close } = await openFresh(browser);
  const met = await playFlow(page, flow, {
    log: (line) => console.log(line),
    afterStep: async (index, label, shown) => {
      await shown.screenshot({ path: path.join(shots, `${String(index).padStart(2, '0')}-${label}.png`) });
    },
  });
  problems.push(...met);
  await close();
}

async function runDoor(browser: Browser, door: string): Promise<void> {
  const { page, close } = await openFresh(browser);
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text().slice(0, 300)}`);
  });
  page.on('pageerror', (error) => problems.push(`console error: page error: ${String(error).slice(0, 300)}`));
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
  await close();
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

console.log(`\nphotos: ${shots}`);
if (problems.length === 0) {
  console.log('the flow ran clean: no incident, no console error, every expectation met.');
  process.exit(0);
}
console.error(`\n${problems.length} problem(s):`);
for (const problem of problems) console.error(`  - ${problem}`);
process.exit(1);
