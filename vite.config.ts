import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { PRODUCT_NAME } from './src/config/product.ts';
import { toothPlugin } from './tools/runner/tooth-plugin.ts';

function readPort(): number {
  const raw = process.env.PORT;
  const port = Number(raw);
  if (!raw || !Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Set the PORT environment variable to a valid port before starting the dev server (got "${raw ?? ''}").`);
  }
  return port;
}

// index.html carries no product name; it is injected from src/config/product.ts.
function productTitle(): Plugin {
  return {
    name: 'product-title',
    transformIndexHtml: (html) => html.replace('<title></title>', `<title>${PRODUCT_NAME}</title>`),
  };
}

// The folders of the project the dev server does not watch, relative to its root: the root's own reference/, .cache/,
// .memory/ and the audit journeys (jornada*/, evidence written while the app is open must not reload it),
// and .playwright-mcp/, never a folder of that name above it (a working copy under .cache/wt is watched whole).
const ROOT = fs.realpathSync(process.cwd());
const UNWATCHED = new Set(['reference', '.cache', '.playwright-mcp', '.memory', 'jornada01', 'jornada02', 'jornada03']);
const unwatched = (file: string): boolean => UNWATCHED.has(path.relative(ROOT, file).split(path.sep)[0] ?? '');

// A change to a source file reloads the whole page: the editor's store and its React context live in modules a hot
// update would load twice (a context no provider provides: "the editor store is missing"). The page comes back with
// the work autosave kept.
function fullReload(): Plugin {
  return {
    name: 'full-reload',
    handleHotUpdate({ server }) {
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

// A build without the test port says so if anything of it is left (the audit's AUD-10: the read-only test port shipped
// in the build a person uses, exposing the document and the incident feed to any script on the page): the port is
// installed behind __BUILDER_TEST_PORT__, which Vite replaces statically, so this build drops its code, and a chunk
// that still names it fails the build.
const TEST_PORT_NAME = '__builderTestPort';
function noTestPort(): Plugin {
  return {
    name: 'no-test-port',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const [file, output] of Object.entries(bundle)) {
        if (output.type === 'chunk' && output.code.includes(TEST_PORT_NAME)) this.error(`${file} carries the test port (${TEST_PORT_NAME}) in a build without it`);
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // PORT is required by the servers, dev and preview (vite preview reports the serve command too), never by a build
  const port = command === 'build' ? null : readPort();
  // the e2e build: E2E_BUILD set by playwright.config.ts, or `npm run build:e2e` (the e2e mode) for npm run ui
  const e2e = process.env.E2E_BUILD === '1' || mode === 'e2e';
  // the test port is in the dev server and the e2e build only (src/editor/test-port.ts)
  const testPort = command === 'serve' || e2e;
  return {
    // toothPlugin() is null unless the scenario runner's tooth proof starts this server (tools/runner/tooth.ts)
    plugins: [react(), productTitle(), toothPlugin(), fullReload(), testPort ? null : noTestPort()],
    define: { __BUILDER_TEST_PORT__: JSON.stringify(testPort) },
    // reference/ holds other projects with their own HTML entries; keep Vite away from them.
    optimizeDeps: { entries: ['index.html'] },
    server: port === null ? {} : { port, strictPort: true, watch: { ignored: unwatched } },
    // the e2e suite serves the build (playwright.config.ts) from `vite preview`, on the same PORT
    preview: port === null ? {} : { port, strictPort: true },
    // the e2e build (E2E_BUILD, set by playwright.config.ts) is not minified and carries its source maps: a run with
    // E2E_COVERAGE records which source lines and selectors each test executed (tests/support/coverage.ts), which
    // npm run e2e:affected reads to choose the tests a change reaches (plan G6, R4)
    build: e2e ? { minify: false, cssMinify: false, sourcemap: true } : {},
  };
});
