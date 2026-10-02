import { describe, expect, it } from 'vitest';
import { adaptiveRules, breakpointHolding, mapBreakpoints, morphCss, morphFrom, morphValue, responsiveEdit } from './continuum.ts';
import { execute, type Operation } from '../gestures/operations.ts';
import type { LayoutIntent } from '../intent/model.ts';
import { drawn } from '../testing/ports.ts';

const BREAKPOINTS = [
  { id: 'desktop', maxWidth: 1440, base: true },
  { id: 'laptop', maxWidth: 1180, base: false },
  { id: 'tablet', maxWidth: 834, base: false },
  { id: 'phone', maxWidth: 390, base: false },
];
const apply = (graph: LayoutIntent, op: Operation) => {
  const r = execute(graph, op);
  if (!r.ok) throw new Error(JSON.stringify(r.problems));
  return r.graph;
};

describe('the responsive continuum', () => {
  const row = drawn(1440, 300, [{ x: 0, y: 0, width: 480, height: 300 }, { x: 480, y: 0, width: 480, height: 300 }, { x: 960, y: 0, width: 480, height: 300 }]);

  it('morphs continuously between control points and writes the segment as native clamp()', () => {
    const points = [{ width: 390, value: 16 }, { width: 834, value: 24 }, { width: 1440, value: 32 }];
    expect(morphValue(points, 300)).toBe(16);
    expect(morphValue(points, 612)).toBe(20);
    expect(morphValue(points, 2000)).toBe(32);
    expect(morphCss({ width: 834, value: 24 }, { width: 1440, value: 32 })).toBe('clamp(24px, calc(12.990099px + 1.320132vw), 32px)');
  });

  it('records a behaviour at the breakpoint that holds the width, one rule per breakpoint', () => {
    expect(breakpointHolding(BREAKPOINTS, 700)?.id).toBe('tablet');
    expect(breakpointHolding(BREAKPOINTS, 1300)).toBeNull();
    const stacked = apply(row, responsiveEdit(row, 834, { kind: 'stack', parent: null }));
    const hidden = apply(stacked, responsiveEdit(stacked, 834, { kind: 'hide', ids: ['r2'] }));
    expect(hidden.responsive).toEqual([{ id: 'w1', maxWidth: 834, hidden: ['r2'], columns: 1 }]);
    const two = apply(hidden, responsiveEdit(hidden, 1180, { kind: 'columns', parent: null, columns: 2 }));
    expect(two.responsive.map((r) => [r.maxWidth, r.columns])).toEqual([[1180, 2], [834, 1]]);
    expect(mapBreakpoints(two, BREAKPOINTS)).toEqual({ w1: 'tablet', w2: 'laptop' });
    const unstacked = apply(two, responsiveEdit(two, 834, { kind: 'unstack', parent: null }));
    expect(unstacked.responsive.find((r) => r.maxWidth === 834)?.columns).toBeUndefined();
  });

  it('refuses a threshold no project breakpoint names, instead of rounding it', () => {
    const odd = apply(row, { kind: 'responsive', rule: { id: 'w1', maxWidth: 700, hidden: [] } });
    expect(() => mapBreakpoints(odd, BREAKPOINTS)).toThrow();
  });

  it('turns the jumps of a value into one fluid curve', () => {
    const op = morphFrom(row, 'r1', 'gap', [{ width: 1440, value: 32 }, { width: 390, value: 16 }, { width: 834, value: 24 }]);
    const graph = apply(row, op);
    expect(graph.morphs?.[0]?.points.map((p) => p.width)).toEqual([390, 834, 1440]);
    expect(mapBreakpoints(graph, BREAKPOINTS)).toEqual({ 'morph:m1:834': 'tablet' });
  });

  it('makes adaptive rules: one column fewer each time the items stop fitting', () => {
    expect(adaptiveRules(row, 260, 24).map((r) => [r.maxWidth, r.columns])).toEqual([[827, 2], [543, 1]]);
  });
});
