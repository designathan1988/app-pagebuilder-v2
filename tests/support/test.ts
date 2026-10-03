// The one entry point of every browser test: specs and the scenario runner import `test` and `expect` from here,
// never from '@playwright/test' directly (lint: a spec that imports them anywhere else fails). tests/support/editor.ts
// opens the editor once per test, in a fresh profile.
import { test as base, expect } from '@playwright/test';
import { COVERAGE, startCoverage, stopCoverage } from './coverage.ts';

// Every test ends by reading the incident feed of its page (src/core/incidents.ts, through the test port): a command
// that left a document the model refuses, one that claimed a structural change it did not make, or an error the page
// threw, fails the test that caused it — whatever the test itself asserted. A page the test closed or never opened
// the editor in has no feed to read.
export const test = base.extend<{ incidentGuard: undefined; coverage: undefined }>({
  // with E2E_COVERAGE=1, what the test executed of the editor, for npm run e2e:affected (tests/support/coverage.ts)
  coverage: [
    async ({ page }, use, info) => {
      if (!COVERAGE) {
        await use(undefined);
        return;
      }
      await startCoverage(page);
      await use(undefined);
      if (!page.isClosed()) await stopCoverage(page, info).catch(() => undefined);
    },
    { auto: true },
  ],
  incidentGuard: [
    async ({ page }, use) => {
      await use(undefined);
      if (page.isClosed()) return;
      const found = await page
        .evaluate(() => (window as unknown as { __builderTestPort?: { incidents: () => unknown[] } }).__builderTestPort?.incidents() ?? [])
        .catch(() => []);
      expect(found, 'the incident feed of the page').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Download, Locator, Page, TestInfo } from '@playwright/test';
