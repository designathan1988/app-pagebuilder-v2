// The coverage selection (plan G6): a diff's changed lines, a stylesheet's changed rules, and the tests that ran them.
import { describe, expect, it } from 'vitest';
import { changedLines, selectorsOn, testsReached } from './affected-coverage.ts';

describe('the tests a change reaches by their coverage', () => {
  it('reads the old side of a diff: a change its lines, an insertion the line it follows', () => {
    const diff = ['--- a/src/x.ts', '+++ b/src/x.ts', '@@ -10,2 +10,3 @@', '@@ -40,0 +42,1 @@', '--- a/src/y.css', '+++ b/src/y.css', '@@ -3 +3 @@'].join('\n');
    expect(changedLines(diff)).toEqual(new Map([['src/x.ts', [[10, 11], [40, 41]]], ['src/y.css', [[3, 3]]]]));
  });

  it('names the selectors of the rules standing on the changed lines', () => {
    const css = '.a {\n  color: red;\n}\n\n.b,\n.c > .d {\n  margin: 0;\n}\n';
    expect([...selectorsOn(css, [[7, 7]])]).toEqual(['.b', '.c>.d']);
    expect([...selectorsOn(css, [[2, 2]])]).toEqual(['.a']);
  });

  it('keeps the tests that ran a changed line or used a changed selector, and no other', () => {
    const records = [
      { test: 'a › one', lines: { 'src/x.ts': [[5, 12]] as [number, number][] }, selectors: ['.menu'] },
      { test: 'a › two', lines: { 'src/x.ts': [[30, 35]] as [number, number][] }, selectors: ['.row'] },
      { test: 'b › three', lines: {}, selectors: ['.c > .d'] },
    ];
    expect(testsReached(records, new Map([['src/x.ts', [[10, 11]]]]), new Set())).toEqual(['a › one']);
    expect(testsReached(records, new Map(), new Set(['.c>.d']))).toEqual(['b › three']);
    expect(testsReached(records, new Map([['src/z.ts', [[1, 1]]]]), new Set())).toEqual([]);
  });
});
