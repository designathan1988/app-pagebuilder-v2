// AL1: an availability predicate that reads one value reads the element's classes too — a card made a flex container
// by its class was refused the alignment matrix, and a grid made by a class the grid editor.
import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../../editor/store.ts';
import { manualClock } from '../ports/clock.ts';
import { sequentialIds } from '../ports/ids.ts';
import type { CommandId } from '../../generated/ids.ts';
import { RULES, documentOf, node } from '../testing/handlers.ts';
import { valuePredicateHolds } from './couplings.ts';

const flex = { name: 'card', styles: { desktop: { base: { display: 'flex' } } } };
const plain = { name: 'plain', styles: { desktop: { base: { display: 'block' } } } };

describe('a value predicate reads the element\'s classes (AL1)', () => {
  it('holds for a container its class makes flex, its own value first, the last class of the project that sets it winning', () => {
    const card = node('Card', 'div', 'div', { classes: ['card'] });
    expect(valuePredicateHolds(card, 'flexOrGridContainer', RULES, [flex])).toBe(true);
    expect(valuePredicateHolds(card, 'flexOrGridContainer', RULES, [])).toBe(false);
    expect(valuePredicateHolds({ ...card, styles: { desktop: { base: { display: 'block' } } } }, 'flexOrGridContainer', RULES, [flex])).toBe(false);
    const both = node('Both', 'div', 'div', { classes: ['plain', 'card'] });
    expect(valuePredicateHolds(both, 'flexOrGridContainer', RULES, [flex, plain])).toBe(false);
    expect(valuePredicateHolds(both, 'flexOrGridContainer', RULES, [plain, flex])).toBe(true);
  });

  it('lets the alignment matrix set a container its class makes flex', () => {
    const memory = () => {
      let held: string | null = null;
      return { read: () => held, write: (text: string) => void (held = text) };
    };
    const card = node('Card', 'div', 'div', { classes: ['card'] });
    const document = documentOf({ pages: [{ id: 'p', name: 'Home', file: 'index.html', tree: node('Page', 'page', 'body', { children: [card] }) }], classes: [flex] });
    const store = createEditorStore({ storage: memory(), workspace: memory(), clock: manualClock(1), ids: sequentialIds('x'), restored: { document, selection: [card.id] }, ports: { readOnly: () => false }, freeze: true });
    const answer = (store.dispatch as unknown as (id: CommandId, args: unknown) => { status: string })('style.setAlignment' as CommandId, { x: 'center', y: 'center' });
    expect(answer.status).toBe('done');
  });
});
