// A look at what each side draws for some doors in one state, to find why they diverge (the pairing's companion):
//   PARITY_PROBE="default:style.set#inspector-flex-direction,quick-panel" \
//     npx playwright test -c tools/parity/parity.config.ts
// prints, for the design and the app, each element marked with a door (data-door) or a region (data-region) named:
// its tag, classes, box and a short outerHTML. Written to .cache/logs/parity/probe.txt.
import fs from 'node:fs';
import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, openCanon, setUpState, type State } from './states.ts';

const [state = 'default', list = ''] = (process.env.PARITY_PROBE ?? '').split(':');
const marks = list.split(',').filter((one) => one !== '');

const look = (page: Page, names: readonly string[]) =>
  page.evaluate((names) => names.map((name) => {
    const found = [...document.querySelectorAll(`[data-door="${name}"], [data-region="${name}"]`)].slice(0, 3);
    return `${name}:\n${found.map((el) => {
      const r = el.getBoundingClientRect();
      return `  <${el.localName} class="${el.getAttribute('class') ?? ''}"> ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.x)},${Math.round(r.y)}\n    ${el.outerHTML.replace(/\s+/g, ' ').slice(0, 600)}`;
    }).join('\n') || '  (not drawn)'}`;
  }).join('\n'), names);

test('probe', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const canon = await context.newPage();
  await openCanon(canon, state as State, 'dark', 'en');
  const app = await context.newPage();
  await openApp(app, `${baseURL ?? ''}/`, 'dark', 'en');
  await setUpState(app, state as State);
  const text = `# ${state}\n\n## design\n${await look(canon, marks)}\n\n## app\n${await look(app, marks)}\n`;
  fs.mkdirSync('.cache/logs/parity', { recursive: true });
  fs.writeFileSync('.cache/logs/parity/probe.txt', text);
  await context.close();
});
