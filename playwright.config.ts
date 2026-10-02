import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { CHANNEL, REDUCED_MOTION } from './tools/runner/environment.ts';

// The e2e run builds the app once and serves the build on this port (a static `vite preview`, much faster per
// test than the dev server); it never talks to a stale or foreign server.
const port = process.env.E2E_PORT ?? '5310';
const baseURL = `http://localhost:${port}`;

// A folder of this project, matched on the absolute path from the project's own root: a pattern such as
// '**/.cache/**' would also ignore every test when the project itself sits under a .cache folder.
const root = path.dirname(fileURLToPath(import.meta.url));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const under = (dir: string) => new RegExp(`^${[...root.split(/[\\/]/), dir].map(escape).join('[\\\\/]')}[\\\\/]`, 'i');

// E2E_WORKERS must be a whole number of at least 1; a typo fails the run instead of silently using every core. By
// default, a quarter of the machine's cores, from 2 to 6: each worker drives a Chrome that renders, and the machine
// stays usable while the suite runs (at half the cores, 12 on 24, the owner's computer froze).
function workerCount(value: string | undefined): number {
  if (value === undefined || value === '') return Math.max(2, Math.min(6, Math.floor(os.availableParallelism() / 4)));
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) throw new Error(`E2E_WORKERS must be a whole number >= 1, got "${value}"`);
  return count;
}

export default defineConfig({
  testDir: 'tests/e2e',
  // Never discover tests in the reference projects or a scratch copy.
  testIgnore: [under('reference'), under('.cache'), under('.playwright-mcp')],
  fullyParallel: true,
  workers: workerCount(process.env.E2E_WORKERS),
  forbidOnly: !!process.env.CI,
  retries: 0,
  // the list of results, then each feature's status derived from its scenario tests (tools/runner/status.ts)
  reporter: [['list'], ['./tools/runner/status.ts']],
  // a failure shows in seconds: every action and every expect waits at most 5 s, a navigation 15 s
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    // the browser and the motion the contract names (manifest/environment.json, tools/runner/environment.ts)
    channel: CHANNEL,
    reducedMotion: REDUCED_MOTION,
    // the browser's language is pinned: the editor opens in it (jornada03 J26), and the scenarios name their locale
    locale: 'en-US',
    // no trace while testing: 'retain-on-failure' records every test and costs 38% of the suite's CPU; a failure is
    // diagnosed by running the failed tests again with their trace: npm run e2e:diagnose
    trace: 'off',
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    // the app under test is the build, served statically; tests/support/proofs.ts is built beside it for the
    // browser-side proofs
    command: 'npm run build && npm run build:proofs && npm run preview',
    url: baseURL,
    // the tooth proof (tools/runner/tooth.ts) switches a feature off in the build it makes here (tooth-plugin.ts)
    // E2E_BUILD: the e2e build is not minified, for the traces to read
    env: { PORT: port, E2E_BUILD: '1', TOOTH_COMMANDS: process.env.TOOTH_COMMANDS ?? '', TOOTH_MODULE: process.env.TOOTH_MODULE ?? '' },
    reuseExistingServer: false,
    // the build runs first: a cold one takes about a minute
    timeout: 240_000,
  },
});
