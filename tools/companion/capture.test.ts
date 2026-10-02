// The project path a captured page takes from its address (tools/companion/capture.ts pagePath, spec capture-url).
import { describe, expect, it } from 'vitest';
import { pagePath, scopeCss } from './capture.ts';

describe('a captured page’s path', () => {
  it('follows its address', () => {
    expect(pagePath('https://example.com/')).toBe('index.html');
    expect(pagePath('https://example.com/plans/')).toBe('plans/index.html');
    expect(pagePath('https://example.com/about')).toBe('about.html');
    expect(pagePath('https://example.com/a/b.html?x=1#top')).toBe('a/b.html');
  });
});

describe('the rules of custom elements and shadow roots', () => {
  const custom = new Set(['x-badge', 'mdn-dropdown']);
  it('writes a custom element’s tag as the class its div wears', () => {
    expect(scopeCss('mdn-dropdown > a, x-badge.big { color: red }', null, custom)).toBe('.ce-mdn-dropdown>a,.ce-x-badge.big{color:red}');
  });
  it('keeps a shadow root’s rules within their host', () => {
    expect(scopeCss(':host { display: block } p { color: red } :host(.big) ::slotted(span) { margin: 0 }', 'x-badge', custom)).toBe('.ce-x-badge{display:block}.ce-x-badge p{color:red}.ce-x-badge.big span{margin:0}');
  });
  it('leaves keyframes and a page with no custom element as they are', () => {
    expect(scopeCss('@keyframes spin { from { opacity: 0 } }', 'x-badge', custom)).toContain('from{opacity:0}');
    expect(scopeCss('p { color: red }', null, new Set())).toBe('p { color: red }');
  });
});
