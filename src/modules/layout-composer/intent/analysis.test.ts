import { describe, expect, it } from 'vitest';
import { ambiguous, canonicalize, contentPressure, interpretations, layoutDiff, patterns, predict, stress, stressWidths, suggestions, unstableAt } from './analysis.ts';
import { execute } from '../gestures/operations.ts';
import { chooseInterpretation } from '../gestures/structural.ts';
import type { LayoutIntent } from './model.ts';
import { drawn } from '../testing/ports.ts';

describe('what the composer understands from geometry', () => {
  const cards = drawn(1000, 300, [0, 1, 2, 3].map((i) => ({ x: i * 224, y: 0, width: 200, height: 200 })));

  it('recognizes a repeated row, its count and its gap, and predicts "4 equal columns · gap 24"', () => {
    expect(patterns(cards)[0]).toMatchObject({ kind: 'repeated-row', count: 4, gap: 24, parent: null });
    expect(predict(cards, null)).toEqual({ key: 'layout.predict.columns', params: { count: 4, gap: 24, sizing: 'fluid' } });
  });

  it('offers the readings of a group, the likeliest first, and lets the person choose one before it is final', () => {
    const candidates = interpretations(cards, null);
    expect(candidates[0]?.kind).toBe('repeat');
    expect(candidates.map((c) => c.kind)).toContain('flex');
    expect(ambiguous(candidates)).toBe(true);
    const op = chooseInterpretation(cards, candidates.find((c) => c.kind === 'flex') ?? (candidates[0] as (typeof candidates)[number]));
    const result = execute(cards, op);
    expect(result.ok && result.graph.preferences).toEqual({ $root: 'flex' });
  });

  it('recognizes sidebars, grids, masonry and dashboards', () => {
    expect(patterns(drawn(1000, 500, [{ x: 0, y: 0, width: 250, height: 500 }, { x: 250, y: 0, width: 750, height: 500 }]))[0]?.kind).toBe('sidebar');
    const grid = drawn(500, 500, [0, 1, 2, 3].map((i) => ({ x: (i % 2) * 250, y: Math.floor(i / 2) * 250, width: 240, height: 240 })));
    expect(patterns(grid).some((p) => p.kind === 'grid')).toBe(true);
    const masonry = drawn(600, 700, [{ x: 0, y: 0, width: 280, height: 300 }, { x: 0, y: 320, width: 280, height: 200 }, { x: 300, y: 0, width: 280, height: 150 }, { x: 300, y: 170, width: 280, height: 400 }]);
    expect(patterns(masonry).some((p) => p.kind === 'masonry')).toBe(true);
  });

  it('says what changed in words: narrower, sizing, columns', () => {
    const before = drawn(1000, 500, [{ x: 0, y: 0, width: 280, height: 500 }, { x: 280, y: 0, width: 720, height: 500 }], (r, i) => ({ ...r, name: i === 0 ? 'Sidebar' : 'Main' }));
    const after: LayoutIntent = { ...before, regions: before.regions.map((r) => (r.id === 'r1' ? { ...r, box: { ...r.box, width: 240 } } : { ...r, box: { ...r.box, x: 240, width: 760 }, width: { mode: 'fill-available' } })) };
    expect(layoutDiff(before, after)).toEqual([
      { key: 'layout.diff.narrower', params: { name: 'Sidebar', before: 280, after: 240 } },
      { key: 'layout.diff.wider', params: { name: 'Main', before: 720, after: 760 } },
      { key: 'layout.diff.sizing', params: { name: 'Main', before: 'fluid', after: 'fill-available' } },
    ]);
  });

  it('finds where real content breaks the structure, and the widest width it breaks at', () => {
    const row = drawn(1200, 300, [{ x: 0, y: 0, width: 600, height: 300 }, { x: 600, y: 0, width: 600, height: 300 }]);
    const issues = stress(row, [1200, 900, 684, 500].map((width) => ({ width, scale: 1, content: { r1: { minWidth: 350, minHeight: 100 } } })));
    expect(issues.map((i) => i.viewport)).toEqual([684, 500]);
    expect(unstableAt(issues)).toBe(684);
    expect(stressWidths(1440, [1180, 834, 390], 320, 4)).toEqual([1440, 1180, 1160, 880, 834, 600, 390, 320]);
  });

  it('suggests only on strong evidence, and keeps content minima when sizing is fluid', () => {
    const uneven = drawn(1000, 300, [{ x: 0, y: 0, width: 200, height: 200 }, { x: 224, y: 0, width: 200, height: 200 }, { x: 449, y: 0, width: 200, height: 200 }]);
    expect(suggestions(uneven).map((s) => s.kind)).toContain('equal-gap');
    expect(suggestions(cards).map((s) => s.kind)).toContain('repeat');
    const r = cards.regions[0];
    if (r === undefined) throw new Error('no region');
    expect(contentPressure(r, { minWidth: 220.4, preferredWidth: 300 }).width).toEqual({ mode: 'fluid', min: 220 });
  });

  it('canonicalizes duplicated relations and orders what has no order of its own', () => {
    const doubled: LayoutIntent = { ...cards, constraints: [{ id: 'c1', kind: 'equal-size', axis: 'x', regions: ['r1', 'r2'] }, { id: 'c2', kind: 'equal-size', axis: 'x', regions: ['r2', 'r1'] }], variables: { b: 2, a: 1 } };
    const canonical = canonicalize(doubled);
    expect(canonical.constraints.map((c) => c.id)).toEqual(['c1']);
    expect(Object.keys(canonical.variables)).toEqual(['a', 'b']);
  });
});
