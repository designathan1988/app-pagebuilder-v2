import { defineConfig } from '@playwright/test';
import base from '../../playwright.config.ts';

export default defineConfig(base, {
  testDir: '.', testMatch: '**/*.perf.ts', fullyParallel: false, workers: 1,
  reporter: [['list']], retries: 0, timeout: 90_000,
  use: { ...base.use, trace: 'off' },
});
