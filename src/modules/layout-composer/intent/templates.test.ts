import { describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES, builtInTemplate, createTemplate, placeTemplate } from './templates.ts';
import { bindVariable, editValue, refOf, removeVariable, usages } from './variables.ts';
import { DEFAULT_NAMING, execute, type Operation } from '../gestures/operations.ts';
import { paintConstraint } from '../gestures/structural.ts';
import { emptyIntent, findRegion, type LayoutIntent } from './model.ts';
import { validateIntent } from '../topology/topology.ts';
import { drawn } from '../testing/ports.ts';

const apply = (graph: LayoutIntent, op: Operation) => {
  const r = execute(graph, op);
  if (!r.ok) throw new Error(JSON.stringify(r.problems));
  return r.graph;
};
const words = (key: string) => key.slice(key.lastIndexOf('.') + 1);

describe('templates and spatial components', () => {
  it('builds every built-in template as a valid composition in the person’s words', () => {
    for (const kind of BUILT_IN_TEMPLATES) {
      const template = builtInTemplate(kind, words);
      expect(validateIntent(template.graph)).toEqual([]);
      expect(template.name).toBe(kind);
    }
    expect(builtInTemplate('gallery', words).parameters.columns1).toEqual({ kind: 'columns', value: 4, first: 'r1' });
    expect(builtInTemplate('landing', words).parameters.count1).toMatchObject({ kind: 'count', value: 3 });
  });

  it('saves the selected regions as a reusable structure with its parameters, and places it scaled with new counts', () => {
    const base = drawn(1200, 600, [0, 1, 2].map((i) => ({ x: i * 408, y: 0, width: 384, height: 300 })));
    const withGap = apply({ ...base, variables: { cardGap: 24 } }, paintConstraint({ ...base, variables: { cardGap: 24 } }, 'gap', ['r1', 'r2', 'r3'], 'x', 'cardGap'));
    const template = createTemplate('Cards', withGap, ['r1', 'r2', 'r3']);
    expect(template.parameters.cardGap).toEqual({ kind: 'variable', value: 24 });
    expect(template.parameters.count1).toMatchObject({ kind: 'count', value: 3 });
    const target = emptyIntent(1200, 900);
    const placed = apply(target, placeTemplate(target, template, { parent: null, box: { x: 0, y: 0, width: 1200, height: 300 } }, { count1: 4, cardGap: 32 }, DEFAULT_NAMING));
    expect(placed.regions).toHaveLength(4);
    expect(placed.variables.cardGap).toBe(32);
    expect(placed.constraints).toHaveLength(1);
  });
});

describe('layout variables', () => {
  const base = drawn(1000, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 324, y: 0, width: 300, height: 300 }, { x: 648, y: 0, width: 300, height: 300 }]);
  const withGap = apply(base, paintConstraint(base, 'gap', ['r1', 'r2', 'r3'], 'x', 24));

  it('makes a value a variable, changes all of its places, or only this one', () => {
    const bound = apply(withGap, bindVariable(withGap, { kind: 'constraint', id: 'c1' }, 'cardGap'));
    expect(bound.variables).toEqual({ cardGap: 24 });
    expect(usages(bound, 'cardGap')).toEqual([{ kind: 'constraint', id: 'c1' }]);
    const all = apply(bound, editValue(bound, { kind: 'constraint', id: 'c1' }, 40, 'all'));
    expect(all.variables.cardGap).toBe(40);
    expect(findRegion(all, 'r2')?.box.x).toBe(340);
    const one = apply(bound, editValue(bound, { kind: 'constraint', id: 'c1' }, 16, 'this'));
    expect(one.variables.cardGap).toBe(24);
    expect(usages(one, 'cardGap')).toEqual([]);
    const removed = apply(bound, removeVariable(bound, 'cardGap'));
    expect(removed.variables).toEqual({});
    expect(refOf('padding:r1')).toEqual({ kind: 'padding', region: 'r1' });
    // a name the design tokens could not take is refused before any operation exists
    expect(() => bindVariable(withGap, { kind: 'constraint', id: 'c1' }, '1bad')).toThrow();
  });
});
