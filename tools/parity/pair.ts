// The pairing of the app with the canonical design (the plan's stage 0.4 and stage 5): both opened at 1440 × 900 in one
// state, each region the two mark with the same data-region cropped from each, the canonical's above the app's, into
// .cache/logs/parity-<time>/<state>-<region>-canon.png and -app.png, with what the region measures on each side (its
// box, its background, its text colour) in report.txt. Run: node tools/parity/pair.ts [state] [theme], the design
// served on 5394 (node tools/parity/serve-design.ts) and the app on PORT (5320). npm run parity measures every state in
// numbers.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { openApp, openCanon, setUpState, type State, type Theme } from './states.ts';

const STATE = (process.argv[2] ?? 'selection') as State;
// the theme both are shown in (third argument: dark, the default, or light)
const THEME = (process.argv[3] ?? 'dark') as Theme;
const APP = `http://localhost:${process.env.PORT ?? '5320'}/`;
const out = path.join('.cache/logs', `parity-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(out, { recursive: true });

// both brought to the state as tools/parity/states.ts brings them (the numeric pairing does the same)
const browser = await chromium.launch({ channel: 'chrome' });
const canon = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
await openCanon(canon, STATE, THEME, 'en');
const app = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
await openApp(app, APP, THEME, 'en');
await setUpState(app, STATE);

type Box = { x: number; y: number; width: number; height: number };
const regions = async (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-region]')].flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > 900) return [];
      const cs = getComputedStyle(el);
      return [{ id: el.getAttribute('data-region') as string, box: { x: r.x, y: r.y, width: r.width, height: r.height }, bg: cs.backgroundColor, color: cs.color, font: `${cs.fontSize} ${cs.fontWeight}` }];
    }),
  );
const a = await regions(canon);
const b = await regions(app);
const lines: string[] = [];
for (const one of a) {
  const other = b.find((x) => x.id === one.id);
  lines.push(`${one.id}\n  canon ${JSON.stringify(one.box)} bg=${one.bg} color=${one.color} font=${one.font}\n  app   ${other ? `${JSON.stringify(other.box)} bg=${other.bg} color=${other.color} font=${other.font}` : 'NOT DRAWN'}`);
  if (!other) continue;
  const clip = (box: Box): Box => ({ x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(1440 - Math.max(0, box.x), box.width), height: Math.min(900 - Math.max(0, box.y), box.height) });
  // the two crops, side by side in name: <state>-<region>-canon.png above <state>-<region>-app.png (joined by
  // tools/parity/join.ts)
  const name = `${STATE}${THEME === 'dark' ? '' : `-${THEME}`}-${one.id.replace(/[:]/g, '_')}`;
  await canon.screenshot({ path: path.join(out, `${name}-canon.png`), clip: clip(one.box) });
  await app.screenshot({ path: path.join(out, `${name}-app.png`), clip: clip(other.box) });
}
for (const one of b) if (!a.some((x) => x.id === one.id)) lines.push(`${one.id}\n  canon NOT DRAWN\n  app   ${JSON.stringify(one.box)}`);
fs.writeFileSync(path.join(out, 'report.txt'), lines.join('\n'));
await canon.screenshot({ path: path.join(out, `${STATE}${THEME === 'dark' ? '' : `-${THEME}`}-whole-canon.png`) });
await app.screenshot({ path: path.join(out, `${STATE}${THEME === 'dark' ? '' : `-${THEME}`}-whole-app.png`) });
console.log(out);
await browser.close();
