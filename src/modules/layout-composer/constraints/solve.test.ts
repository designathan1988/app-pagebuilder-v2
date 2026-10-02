import { describe, expect, it } from 'vitest';
import { resolveValue, solve } from './solve.ts';
import { execute } from '../gestures/operations.ts';
import { paintConstraint } from '../gestures/structural.ts';
import { findRegion, type LayoutIntent } from '../intent/model.ts';
import { drawn } from '../testing/ports.ts';

const apply = (graph: LayoutIntent, kind: Parameters<typeof paintConstraint>[1], ids: string[], axis: 'x' | 'y', value?: number | string) => {
  const result = execute(graph, paintConstraint(graph, kind, ids, axis, value));
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.graph;
};
const widths = (graph: LayoutIntent) => graph.regions.map((r) => r.box.width);

describe('the constraint solver', () => {
  const row = drawn(1000, 300, [{ x: 0, y: 0, width: 280, height: 300 }, { x: 304, y: 0, width: 320, height: 300 }, { x: 648, y: 0, width: 300, height: 300 }]);

  it('makes regions the same width and keeps the row a row', () => {
    const equal = apply(row, 'equal-size', ['r1', 'r2', 'r3'], 'x');
    expect(widths(equal)).toEqual([300, 300, 300]);
    expect(equal.regions.map((r) => r.box.x)).toEqual([0, 324, 648]);
  });

  it('takes a fixed region’s length as the one the others match', () => {
    const fixed = { ...row, regions: row.regions.map((r) => (r.id === 'r1' ? { ...r, width: { mode: 'fixed' as const } } : r)) };
    expect(widths(apply(fixed, 'equal-size', ['r1', 'r2'], 'x'))).toEqual([280, 280, 300]);
  });

  it('keeps an equal gap, from a number or a layout variable', () => {
    expect(apply(row, 'gap', ['r1', 'r2', 'r3'], 'x', 10).regions.map((r) => r.box.x)).toEqual([0, 290, 620]);
    const withVariable: LayoutIntent = { ...row, variables: { cardGap: 32 } };
    expect(apply(withVariable, 'gap', ['r1', 'r2', 'r3'], 'x', 'cardGap').regions.map((r) => r.box.x)).toEqual([0, 312, 664]);
    expect(resolveValue(withVariable, 'cardGap')).toBe(32);
  });

  it('keeps a ratio, aligns edges, fixes a size and fills the remaining space', () => {
    const square = apply(row, 'ratio', ['r1'], 'x', 1);
    expect(findRegion(square, 'r1')?.box.height).toBe(280);
    const aligned = apply(drawn(800, 400, [{ x: 0, y: 10, width: 100, height: 100 }, { x: 200, y: 40, width: 100, height: 50 }]), 'align-end', ['r1', 'r2'], 'y');
    expect(aligned.regions.map((r) => r.box.y + r.box.height)).toEqual([110, 110]);
    const fixed = apply(row, 'fixed', ['r2'], 'x', 250);
    expect(findRegion(fixed, 'r2')?.box.width).toBe(250);
    expect(findRegion(fixed, 'r2')?.width.mode).toBe('fixed');
    const filled = apply(row, 'fill-available', ['r3'], 'x');
    expect(findRegion(filled, 'r3')?.box).toEqual({ x: 648, y: 0, width: 352, height: 300 });
  });

  it('holds a region’s own minimum and maximum on its drawing', () => {
    const graph = drawn(800, 300, [{ x: 0, y: 0, width: 200, height: 300 }], (r) => ({ ...r, width: { mode: 'fluid', min: 240 } }));
    expect(findRegion(graph, 'r1')?.box.width).toBe(240);
  });

  it('reports a contradiction instead of dropping it', () => {
    const conflicting: LayoutIntent = {
      ...row,
      regions: row.regions.map((r) => (r.id === 'r1' || r.id === 'r2' ? { ...r, width: { mode: 'fixed' as const } } : r)),
      constraints: [
        { id: 'c1', kind: 'size', axis: 'x', regions: ['r1'], dimension: { mode: 'fixed' }, value: 100 },
        { id: 'c2', kind: 'size', axis: 'x', regions: ['r1'], dimension: { mode: 'fixed' }, value: 200 },
      ],
    };
    expect(solve(conflicting).conflicts.length).toBeGreaterThan(0);
    const result = execute(conflicting, { kind: 'variable', name: 'x', value: 1 });
    expect(result.ok).toBe(false);
  });
});
