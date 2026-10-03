// The task meter's browser runs (STG-0.3; npm run journey): the jornada03 personas' tasks replayed in the installed
// Chrome against the e2e build (its read-only test port reads what each task made), one task at a time, real mouse
// and keyboard, a photo per step (.cache/logs/journey/photos/<task>/) and a record per task
// (.cache/logs/journey/records/<task>.json), which tools/journey/scoreboard.ts reads.
import { defineConfig } from '@playwright/test';
import { CHANNEL } from '../runner/environment.ts';

const port = process.env.JOURNEY_PORT ?? '5341';

export default defineConfig({
  testDir: './tasks',
  testMatch: /\.journey\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  reporter: [['list']],
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    channel: CHANNEL,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    trace: 'off',
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
    acceptDownloads: true,
  },
  webServer: {
    command: 'npm run build && npm run preview',
    port: Number(port),
    env: { PORT: port, E2E_BUILD: '1' },
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
