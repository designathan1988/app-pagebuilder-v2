// The pairing's browser run (STG-0.4; npm run parity): the app's e2e build and the canonical design, each served for
// the run, compared in Chrome state by state (tools/parity/pairing.parity.ts).
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { CHANNEL } from '../runner/environment.ts';

// the project's folder: where the servers run from (a web server's command runs from the configuration's folder)
const root = fileURLToPath(new URL('../..', import.meta.url));

const port = process.env.PARITY_PORT ?? '5343';

export default defineConfig({
  testDir: '.',
  // the pairing, or the probe when PARITY_PROBE names a state and its marks (probe.parity.ts)
  testMatch: process.env.PARITY_PROBE === undefined ? /pairing\.parity\.ts$/ : /probe\.parity\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: CHANNEL,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    trace: 'off',
    actionTimeout: 8_000,
  },
  webServer: [
    { command: 'npm run build && npm run preview', cwd: root, port: Number(port), env: { PORT: port, E2E_BUILD: '1' }, reuseExistingServer: false, timeout: 300_000 },
    { command: 'node tools/parity/serve-design.ts', cwd: root, port: 5394, reuseExistingServer: true, timeout: 30_000 },
  ],
});
