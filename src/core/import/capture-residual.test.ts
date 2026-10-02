// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableCSSFileLoading":true,"handleDisabledFileLoadingAsSuccess":true,"disableJavaScriptFileLoading":true}}
// A captured page keeps what the model does not hold of its sheets (spec capture-url): the import maps what it can into
// classes and values, and the rest — a selector it does not read, an at-rule, a declaration the editor does not store —
// goes into the page's residual stylesheet, its addresses written from where that sheet is. A page that is no capture
// keeps no residual.
import { describe, expect, it } from 'vitest';
import type { PickedFile } from '../../generated/commands.ts';
import { documentOf, runHandler } from '../testing/handlers.ts';
import { capturedPageCss } from './capture-styles.ts';
import { importHtmlCommand } from './import.ts';

const file = (name: string, type: string, text: string): PickedFile => {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return { name, type, bytes: btoa(binary) };
};
const SHEET = [
  '.brand { color: #f5e6d3; --accent: #b9512a; }',
  'nav a:hover > span { color: red; }',
  '@font-face { font-family: Serif; src: url("../fonts/serif.woff2"); }',
  '@media (prefers-color-scheme: dark) { .brand { color: white; } }',
].join('\n');
const page = (meta: string) => `<!doctype html><html><head>${meta}<link rel="stylesheet" href="css/site.css"></head><body><h1 class="brand">Hi</h1><nav><a href="/"><span>x</span></a></nav></body></html>`;

function imported(meta: string) {
  const ran = runHandler(importHtmlCommand, documentOf({ pages: [] }), { files: [file('index.html', 'text/html', page(meta)), file('css/site.css', 'text/css', SHEET)] }, { confirmed: true });
  if (ran.outcome.kind !== 'change') throw new Error(JSON.stringify(ran.outcome));
  expect(ran.problems).toEqual([]);
  return ran.document;
}

describe('the residual stylesheet of a captured page', () => {
  it('keeps the selectors, at-rules and declarations the model does not hold, and nothing it maps', () => {
    const document = imported('<meta name="builder-capture" content="https://example.com/">');
    const home = document.pages[0];
    if (home === undefined) throw new Error('no page');
    const css = capturedPageCss(document, home);
    expect(css).toContain('nav a:hover>span{color:red}');
    expect(css).toContain('--accent: #b9512a');
    expect(css).toContain('@font-face');
    expect(css).toContain('url(fonts/serif.woff2)');
    expect(css).toContain('@media (prefers-color-scheme:dark)');
    // the mapped declaration is the class's, not the residual's
    expect(css).not.toContain('color:#f5e6d3');
  });

  it('is not written for a page that is no capture', () => {
    const document = imported('');
    const home = document.pages[0];
    if (home === undefined) throw new Error('no page');
    expect(capturedPageCss(document, home)).toBe('');
  });
});
