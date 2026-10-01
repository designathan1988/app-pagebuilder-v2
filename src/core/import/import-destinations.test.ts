// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { documentOf, node, runHandler } from '../testing/handlers.ts';
import { importHtmlCommand } from './import.ts';
import { siteFiles } from '../export/export.ts';
import { RULES } from '../testing/handlers.ts';

it('the default import preserves existing pages and chooses a free source filename', () => {
  const document = documentOf({ pages: [{ id: 'client', name: 'Client', file: 'index.html', tree: node('ClientRoot', 'page', 'body', { children: [node('Existing', 'heading', 'h1', { text: 'Client work' })] }) }] });
  const imported = runHandler(importHtmlCommand, document, { files: [{ name: 'index.html', type: 'text/html', bytes: btoa('<title>Legacy</title><h1>Legacy content</h1>') }] });
  expect(imported.document.pages[0]).toEqual(document.pages[0]);
  expect(imported.document.pages).toHaveLength(2);
  expect(imported.document.pages[1]?.file).toBe('index-2.html');
  expect(imported.problems).toEqual([]);
});

it('isolates imported class and asset collisions without changing client styles or files', () => {
  const document = documentOf({ pages: [{ id: 'client', name: 'Client', file: 'index.html', tree: node('ClientRoot', 'page', 'body', { children: [node('Existing', 'div', 'div', { classes: ['card'] })] }) }], classes: [{ name: 'card', styles: { desktop: { base: { color: 'red' } } } }], files: [{ path: 'img/photo.png', type: 'image/png', bytes: btoa('old') }] });
  const imported = runHandler(importHtmlCommand, document, { files: [
    { name: 'index.html', type: 'text/html', bytes: btoa('<style>.card{color:blue;background-image:url("img/photo.png")}</style><div class="card"><img src="img/photo.png" alt="img/photo.png"></div><div class="card">Second shared card</div>') },
    { name: 'img/photo.png', type: 'image/png', bytes: btoa('new') },
  ] });
  expect(imported.problems).toEqual([]);
  expect(imported.document.pages[0]).toEqual(document.pages[0]);
  expect(imported.document.classes?.[0]).toEqual(document.classes?.[0]);
  expect(imported.document.files?.[0]).toEqual(document.files?.[0]);
  expect(imported.document.pages[1]?.tree.children[0]?.classes).toEqual(['card-2']);
  expect(imported.document.pages[1]?.tree.children[0]?.children[0]?.attributes.src).toBe('img/photo-2.png');
  expect(imported.document.pages[1]?.tree.children[0]?.children[0]?.attributes.alt).toBe('img/photo.png');
  expect(imported.document.classes?.[1]?.styles.desktop?.base?.['background-image']).toContain('img/photo-2.png');
});

it('inserts inside a selected container as one group, preserving its siblings', () => {
  const host = node('Host', 'section', 'section', { children: [node('Existing', 'heading', 'h1', { text: 'Keep me' })] });
  const document = documentOf({ pages: [{ id: 'client', name: 'Client', file: 'index.html', tree: node('ClientRoot', 'page', 'body', { children: [host] }) }] });
  const imported = runHandler(importHtmlCommand, document, { destination: 'inside', target: host.id, files: [{ name: 'legacy.html', type: 'text/html', bytes: btoa('<body style="padding:20px"><h2>Imported</h2></body>') }] });
  expect(imported.problems).toEqual([]);
  const children = imported.document.pages[0]?.tree.children[0]?.children;
  expect(children?.[0]).toEqual(host.children[0]);
  expect(children).toHaveLength(2);
  expect(children?.[1]?.type).toBe('div');
  expect(children?.[1]?.children[0]?.text).toBe('Imported');
  expect(imported.document.pages).toHaveLength(1);
});

it('rewrites a link inside paragraph text when its imported page filename collides', () => {
  const document = documentOf({ pages: [{ id: 'client', name: 'Client', file: 'index.html', tree: node('ClientRoot', 'page', 'body', { children: [node('Existing', 'heading', 'h1', { text: 'Client' })] }) }] });
  const imported = runHandler(importHtmlCommand, document, { files: [{ name: 'index.html', type: 'text/html', bytes: btoa('<p>Go <a href="index.html">home</a>.</p>') }] });
  expect(imported.document.pages[1]?.tree.children[0]?.inline).toContainEqual({ tag: 'a', href: 'index-2.html', children: ['home'] });
});

it('exports nested imported text links relative to their page after a filename collision', () => {
  const document = documentOf({ pages: [{ id: 'client', name: 'Client', file: 'index.html', tree: node('ClientRoot', 'page', 'body', { children: [node('Existing', 'heading', 'h1', { text: 'Client' })] }) }] });
  const imported = runHandler(importHtmlCommand, document, { files: [
    { name: 'index.html', type: 'text/html', bytes: btoa('<h1>Home</h1>') },
    { name: 'pages/about.html', type: 'text/html', bytes: btoa('<p>Go <a href="../index.html?from=about#top">home</a>.</p>') },
  ] });
  expect(imported.problems).toEqual([]);
  expect(siteFiles(imported.document, RULES).pages.find(p => p.file === 'pages/about.html')?.html).toContain('href="../index-2.html?from=about#top"');
});

it('inside import remaps inline anchors when an existing HTML ID would collide', () => {
  const root = node('ClientRoot', 'page', 'body', { children: [node('Existing', 'heading', 'h1', { text: 'Client', attributes: { id: 'anchor' } })] });
  const document = documentOf({ pages: [{ id: 'client', name: 'Client', file: 'index.html', tree: root }] });
  const imported = runHandler(importHtmlCommand, document, { destination: 'inside', target: root.id, files: [{ name: 'legacy.html', type: 'text/html', bytes: btoa('<section id="anchor"><p><a href="#anchor">Back</a></p></section>') }] });
  expect(imported.problems).toEqual([]);
  const section = imported.document.pages[0]?.tree.children[1]?.children[0];
  expect(section?.attributes.id).toBe('anchor-copy');
  expect(section?.children[0]?.inline).toEqual([{ tag: 'a', href: '#anchor-copy', children: ['Back'] }]);
});
