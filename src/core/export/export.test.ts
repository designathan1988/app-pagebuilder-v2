import { describe, expect, it } from 'vitest';
import type { NodeId } from '../../generated/commands.ts';
import { manifest } from '../../manifest/runtime.ts';
import type { HandlerContext } from '../commands/registry.ts';
import type { DocNode, DocumentJson } from '../document/model.ts';
import { rulesFromManifest } from '../document/validate.ts';
import { EMPTY_HISTORY } from '../history/history.ts';
import { manualClock } from '../ports/clock.ts';
import { anyCss } from '../ports/css.ts';
import { sequentialIds } from '../ports/ids.ts';
import { nodeMaker, paletteNode } from '../structure/insert.ts';
import { interactionsJs } from '../events/script.ts';
import { noLayout } from '../ports/layout.ts';
import { exportPage, exportProject, previewPage, siteFiles } from './export.ts';

const RULES = rulesFromManifest(manifest.elements, manifest.properties, manifest.html);
const styled = (declarations: Record<string, string>) => ({ desktop: { base: declarations } }) as DocNode['styles'];
const node = (id: string, name: string, type: string, tag: string, fields: Partial<DocNode> = {}): DocNode => ({ id: id as NodeId, type: type as DocNode['type'], name, tag, attributes: {}, classes: [], styles: {}, text: null, children: [], ...fields });
const page = (children: DocNode[]): DocumentJson => ({ version: 1, pages: [{ id: 'p', name: 'Home', file: 'index.html', tree: node('root', 'Page', 'page', 'body', { children }) }] });
const contextOf = (document: DocumentJson, at: number): HandlerContext<never> => ({
  state: { document, selection: [], history: EMPTY_HISTORY, message: null, ui: undefined as never },
  clock: manualClock(at),
  ids: sequentialIds('x'),
  rules: RULES,
  words: (key) => key,
  layout: noLayout,
  css: anyCss,
});

const DOC = page([
  node('hero', 'Hero', 'section', 'section', {
    styles: styled({ 'padding-top': '56px' }),
    children: [node('title', 'Title', 'heading', 'h1', { text: 'A & B', styles: styled({ 'font-size': '32px' }) }), node('cta', 'Call to action', 'paragraph', 'p', { text: 'Go', styles: styled({ color: 'red' }) }), node('plain', 'Plain', 'paragraph', 'p', { text: 'x' })],
  }),
  node('plan', 'Plano assinatura', 'article', 'article', { classes: ['card'], styles: styled({ width: '200px' }) }),
  node('again', 'Hero', 'div', 'div', { styles: styled({ margin: '0' }) }),
]);

describe('the export (specs export-zip, export-bem-css)', () => {
  it('names styled elements in BEM form: blocks, elements of their block, modifiers of an author class, suffixes on collisions', () => {
    const { html, css } = exportPage(DOC, 0, RULES);
    expect(html).toContain('<section class="hero">');
    expect(html).toContain('<h1 class="hero__title">A &amp; B</h1>');
    expect(html).toContain('<p class="hero__call-to-action">Go</p>');
    expect(html).toContain('<p>x</p>');
    expect(html).toContain('<article class="card card--plano-assinatura"></article>');
    expect(html).toContain('<div class="hero-2"></div>');
    expect(css).toContain('.hero__title {\n  font-size: 32px;\n}');
    expect(css).not.toMatch(/#|\[data-/);
  });

  it('gives the same bytes for the same document, whenever it is exported', () => {
    const first = exportProject.run(contextOf(DOC, 1_000), {} as never);
    const second = exportProject.run(contextOf(DOC, 9_000_000_000), {} as never);
    if (first.kind !== 'change' || second.kind !== 'change') throw new Error('the export did not run');
    expect(first.download?.bytes).toEqual(second.download?.bytes);
  });
});

describe('the whitespace between inline neighbours (the journey "site")', () => {
  it('writes an element whose children run on in the line on one line, so no space parts them as the canvas draws none', () => {
    const label = node('label', 'Label', 'label', 'label', { children: [node('name', 'Name', 'paragraph', 'span', { text: 'Name' }), node('field', 'Input', 'input', 'input')] });
    const { html } = exportPage(page([label]), 0, RULES);
    expect(html).toContain('  <label><span>Name</span><input></label>');
  });

  it('keeps one element per line where the layout ignores the whitespace (a flex row) or the children are blocks', () => {
    const links = [node('a1', 'One', 'link', 'a', { text: 'One' }), node('a2', 'Two', 'link', 'a', { text: 'Two' })];
    const flex = node('nav', 'Menu', 'nav', 'nav', { styles: styled({ display: 'flex' }), children: links });
    const { html } = exportPage(page([flex, node('box', 'Box', 'div', 'div', { children: [node('p1', 'P', 'paragraph', 'p', { text: 'a' }), node('p2', 'Q', 'paragraph', 'p', { text: 'b' })] })]), 0, RULES);
    expect(html).toContain('  <nav class="menu">\n    <a>One</a>\n    <a>Two</a>\n  </nav>');
    expect(html).toContain('  <div>\n    <p>a</p>\n    <p>b</p>\n  </div>');
  });

  it('writes the row on one line when one of its breakpoints stops laying it out as a flex', () => {
    const links = [node('a1', 'One', 'link', 'a', { text: 'One' }), node('a2', 'Two', 'link', 'a', { text: 'Two' })];
    const styles = { desktop: { base: { display: 'flex' } }, phone: { base: { display: 'block' } } } as DocNode['styles'];
    const { html } = exportPage(page([node('nav', 'Menu', 'nav', 'nav', { styles, children: links })]), 0, RULES);
    expect(html).toContain('  <nav class="menu"><a>One</a><a>Two</a></nav>');
  });
});

describe('the modal template runtime', () => {
  it('keeps the authored dialog tree and runs the same native dialog script in export and Preview', () => {
    const modal = paletteNode(nodeMaker(page([]), RULES, sequentialIds('modal'), (key) => key), 'template-modal');
    const document = page([modal]);
    expect(modal.tag).toBe('dialog');
    expect(modal.children).toHaveLength(3);
    const site = siteFiles(document, RULES);
    expect(site.pages[0]?.html).toContain('src="js/interactions.js"');
    expect(site.interactions).toContain('dialog.showModal()');
    expect(site.interactions).toContain('dialog.close()');
    expect(previewPage(document, RULES)).toContain('dialog.showModal()');
  });
});

describe('the tabs template runtime', () => {
  it('keeps the authored tree and runs independent panels in export and Preview', () => {
    const tabs = paletteNode(nodeMaker(page([]), RULES, sequentialIds('tabs'), (key) => key), 'template-tabs');
    const document = page([tabs]);
    expect(tabs.children[1]?.children).toHaveLength(1);
    const site = siteFiles(document, RULES);
    expect(site.pages[0]?.html).toContain('src="js/interactions.js"');
    expect(site.interactions).toContain("panel.setAttribute('role', 'tabpanel')");
    expect(site.interactions).toContain('panels[j].hidden = !active');
    expect(site.interactions).toContain("event.key === 'ArrowRight'");
    expect(previewPage(document, RULES)).toContain('panels[j].hidden = !active');
  });

  it('wires a shared component class once while addressing all matching instances', () => {
    const make = nodeMaker(page([]), RULES, sequentialIds('tabs'), (key) => key);
    const document = page([paletteNode(make, 'template-tabs'), paletteNode(make, 'template-tabs')]);
    const script = interactionsJs(document, () => '.shared-tabs') ?? '';
    expect(script.match(/each\('\.shared-tabs'/g)).toHaveLength(1);
  });
});

// The stylesheet stands at css/styles.css, one folder below the images the archive carries at img/: an address a
// declaration names must be written as the browser resolves it from there, or the exported page asks for a file that
// is not where it looks (spec explorer-assets-use: "the export carries every file of the tree at its path ... so the
// exported page shows its images").
describe('a declaration address that names a project file (spec explorer-assets-use)', () => {
  const WITH_IMAGES: DocumentJson = {
    ...page([
      node('hero', 'Hero', 'section', 'section', { styles: styled({ 'background-image': 'url("img/hero.png")' }), children: [node('shot', 'Shot', 'image', 'img', { attributes: { src: 'img/hero.png' } }), node('draft', 'Draft', 'image', 'img', { attributes: { alt: 'A cup' } })] }),
      node('wide', 'Wide', 'div', 'div', { styles: styled({ 'background-image': 'url(https://example.com/remote.png)' }) }),
      node('inline', 'Inline', 'div', 'div', { styles: styled({ 'background-image': 'url("data:image/png;base64,AAAA")' }) }),
    ]),
    files: [{ path: 'img/hero.png', type: 'image/png', bytes: 'AAAA' }],
    classes: [{ name: 'painted', styles: styled({ 'background-image': 'url("img/hero.png")' }) }],
  };

  it('is written relative to the stylesheet, while every other address stands', () => {
    const { css, cssLines } = siteFiles(WITH_IMAGES, RULES);
    expect(css).toContain('background-image: url("../img/hero.png")');
    expect(css).not.toContain('url("img/hero.png")');
    expect(css).toContain('background-image: url(https://example.com/remote.png)');
    expect(css).toContain('background-image: url("data:image/png;base64,AAAA")');
    // the code pane's line view reads the same text the file holds
    expect(cssLines.some((line) => line.text.includes('url("../img/hero.png")'))).toBe(true);
    // the HTML resolves against the page at the root: the path stands there
    expect(siteFiles(WITH_IMAGES, RULES).pages[0]?.html).toContain('src="img/hero.png"');
  });

  it('writes an image with no address: its own alternative text is what a browser falls back to', () => {
    const html = siteFiles(WITH_IMAGES, RULES).pages[0]?.html ?? '';
    // a media part with no address is a draft (writesNode); an image is not: a decorative one carries alt="", which a
    // browser draws as nothing (tests/e2e/media-parts.spec.ts pins the contract)
    expect(html).toContain('<img alt="A cup"');
    expect(html).not.toContain('src=""');
    expect(previewPage(WITH_IMAGES, RULES)).toContain('alt="A cup"');
  });

  it('draws from the stored bytes in the preview, which has no folder to serve it from', () => {
    const html = previewPage(WITH_IMAGES, RULES);
    // the frame's origin is opaque: a blob: URL of the editor's origin does not load there, a data: URL does
    expect(html).toContain('url("data:image/png;base64,AAAA")');
    expect(html).not.toContain('blob:');
    expect(html).not.toContain('url("img/hero.png")');
    expect(html).toContain('url(https://example.com/remote.png)');
    // the page's own sources take the same URL
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });
});

// The audit's AUD-02 on a whole site: every element's base rule comes before any breakpoint block, the blocks follow the
// cascade widest first, and the same project exports the same stylesheet every time (plan STG-6.1).
describe('the site stylesheet in cascade order (AUD-02)', () => {
  it('writes every element rule before the breakpoint blocks, widest first, the same text every time', async () => {
    const fs = await import('node:fs');
    const document = JSON.parse(fs.readFileSync('manifest/features/fixtures/responsive-sections.json', 'utf8')) as DocumentJson;
    const { css } = siteFiles(document, RULES);
    const firstMedia = css.indexOf('@media (max-width: ');
    const lastBase = Math.max(...[...css.matchAll(/^\.[a-z][^\n]* \{$/gm)].map((match) => match.index));
    expect(firstMedia).toBeGreaterThan(lastBase);
    const queries = [...css.matchAll(/^@media \(max-width: (\d+)px\) \{$/gm)].map((match) => Number(match[1]));
    expect(queries).toEqual([...queries].sort((a, b) => b - a));
    expect(new Set(queries).size).toBe(queries.length);
    expect(siteFiles(document, RULES).css).toBe(css);
  });
});
