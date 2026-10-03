// The pairing (STG-0.4, STG-5.20, REQ-U14): the app and the canonical design side by side in each of the design's
// twelve states, in the dark and the light theme, in English and Portuguese — 48 pairs — every region and every control
// both mark measured on both sides (tools/parity/measure.ts), and the divergences written to docs/pairing.json, from
// which tools/parity/report.ts writes docs/PAIRING.md.
import fs from 'node:fs';
import { test } from '@playwright/test';
import { diverging, drawn, type Divergence } from './measure.ts';
import { STATES, openApp, openCanon, setUpState, type Language, type State, type Theme } from './states.ts';
import { readAliases, readFaces } from './report.ts';

interface Pair {
  readonly state: State;
  readonly theme: Theme;
  readonly language: Language;
  readonly regions: number;
  readonly controls: number;
  readonly divergences: readonly Divergence[];
}
const THEMES: readonly Theme[] = ['dark', 'light'];
const facesOf = (side: 'app' | 'canon') => Object.fromEntries(readFaces().filter((one) => one.side === side).map((one) => [one.mark, { ...(one.closest === undefined ? {} : { closest: one.closest }), ...(one.inside === undefined ? {} : { inside: one.inside }) }]));
const [APP_FACES, CANON_FACES] = [facesOf('app'), facesOf('canon')];
const ALIASES = Object.fromEntries(readAliases().map((one) => [one.door, one.as]));
const LANGUAGES: readonly Language[] = ['en', 'pt-BR'];

test('the app paired with the canonical design in every state, theme and language', async ({ browser, baseURL }) => {
  const pairs: Pair[] = [];
  for (const language of LANGUAGES) {
    for (const theme of THEMES) {
      for (const state of STATES) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
        const canon = await context.newPage();
        await openCanon(canon, state, theme, language);
        const app = await context.newPage();
        await openApp(app, `${baseURL ?? ''}/`, theme, language);
        await setUpState(app, state);
        const [a, b] = [await drawn(canon, CANON_FACES), await drawn(app, APP_FACES, ALIASES)];
        pairs.push({ state, theme, language, regions: a.regions.length, controls: a.controls.length, divergences: [...diverging('region', a.regions, b.regions), ...diverging('control', a.controls, b.controls)] });
        await context.close();
      }
    }
  }
  fs.writeFileSync('docs/pairing.json', `${JSON.stringify({ about: 'Written by npm run parity (tools/parity/pairing.parity.ts): the divergences of the app from design/final/index.html in each state, theme and language. docs/PAIRING.md is written from it.', pairs }, null, 2)}\n`);
});
