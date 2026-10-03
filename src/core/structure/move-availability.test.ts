// Move up and Move down are drawn disabled where their press would be refused (the canonical Arrange menu: Move up off
// on a first child), with the words the press says: canMoveUp and canMoveDown ask the commands' own check.
import { describe, expect, it } from 'vitest';
import { RULES, documentOf, node } from '../testing/handlers.ts';
import { canMoveDown, canMoveUp } from './move.ts';

const first = node('First', 'div', 'div');
const middle = node('Middle', 'div', 'div');
const last = node('Last', 'div', 'div');
const box = node('Box', 'div', 'div', { children: [first, middle, last] });
const document = documentOf({ pages: [{ id: 'p', name: 'Home', file: 'index.html', tree: node('Page', 'page', 'body', { children: [box] }) }] });
const at = (...selection: string[]) => ({ document, selection }) as unknown as Parameters<typeof canMoveUp.test>[0];

describe('Move up and Move down available where they would move', () => {
  it('a first child cannot move up and says so; a last child cannot move down; a middle one can both', () => {
    expect(canMoveUp.test(at(first.id), RULES)).toBe(false);
    expect(canMoveUp.refusal?.(at(first.id), RULES)).toEqual({ key: 'status.move.alreadyFirst', params: { parent: 'Box' } });
    expect(canMoveDown.test(at(first.id), RULES)).toBe(true);
    expect(canMoveDown.test(at(last.id), RULES)).toBe(false);
    expect(canMoveUp.test(at(middle.id), RULES)).toBe(true);
    expect(canMoveDown.test(at(middle.id), RULES)).toBe(true);
  });

  it('refuses nothing selected, elements of two parents, and a page root', () => {
    expect(canMoveUp.refusal?.(at(), RULES)).toEqual({ key: 'refusal.nothingSelected', params: {} });
    expect(canMoveDown.test(at(first.id, box.id), RULES)).toBe(false);
    expect(canMoveUp.test(at(document.pages[0]?.tree.id ?? ''), RULES)).toBe(false);
  });
});

describe('several selected', () => {
  it('move while one of them can pass a sibling, and not when they stand together against the edge', () => {
    expect(canMoveUp.test(at(first.id, last.id), RULES)).toBe(true);
    expect(canMoveUp.test(at(first.id, middle.id), RULES)).toBe(false);
    expect(canMoveDown.test(at(middle.id, last.id), RULES)).toBe(false);
  });
});
