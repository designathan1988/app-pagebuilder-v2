import { describe, expect, it } from 'vitest';
import { execute, reverse, type Operation, type Result } from './operations.ts';
import { changeRepeat, editBoundary, paintConstraint, removeRedundantWrappers, cycleSelection, nextSelection } from './structural.ts';
import { emptyIntent, findRegion, region, type LayoutIntent } from '../intent/model.ts';
import { topology } from '../topology/topology.ts';
import { drawn } from '../testing/ports.ts';

const ok = (result: Result): Extract<Result, { ok: true }> => {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.problems)}`);
  return result;
};
const run = (graph: LayoutIntent, op: Operation) => ok(execute(graph, op));
const codes = (result: Result) => (result.ok ? [] : result.problems.map((p) => p.code));
const boxOf = (graph: LayoutIntent, id: string) => findRegion(graph, id)?.box;

describe('the gesture algebra', () => {
  it('draws, splits and cuts with ids the graph hands out, the first part keeping the region', () => {
    const empty = emptyIntent(1200, 600);
    const one = run(empty, { kind: 'draw', region: region('r1', { x: 0, y: 0, width: 1200, height: 600 }) }).graph;
    const split = run(one, { kind: 'split', ids: ['r1'], axis: 'x', positions: [400, 800] });
    expect(split.graph.regions.map((r) => [r.id, r.box.x, r.box.width])).toEqual([
      ['r1', 0, 400],
      ['r2', 400, 400],
      ['r3', 800, 400],
    ]);
    expect(split.moves).toEqual({});
    const cut = run(split.graph, { kind: 'cut', from: { x: -10, y: 300 }, to: { x: 1210, y: 300 } });
    expect(cut.graph.regions).toHaveLength(6);
    expect(cut.graph.revision).toBe(3);
    expect(findRegion(cut.graph, 'r4')?.provenance).toEqual(['op1', 'op2', 'op3']);
  });

  it('refuses a cut that crosses nothing and a merge of regions that are not siblings, changing nothing', () => {
    const graph = drawn(1000, 500, [{ x: 0, y: 0, width: 500, height: 500 }, { x: 500, y: 0, width: 500, height: 500 }]);
    expect(codes(execute(graph, { kind: 'cut', from: { x: 2000, y: 0 }, to: { x: 2000, y: 500 } }))).toEqual(['cut-nothing']);
    const nested = run(graph, { kind: 'draw', region: { ...region('r3', { x: 10, y: 10, width: 100, height: 100 }), parent: 'r1' } }).graph;
    expect(codes(execute(nested, { kind: 'merge', ids: ['r2', 'r3'] }))).toEqual(['merge-siblings']);
  });

  it('merges a sweep of regions into one, says where their content goes, and keeps the shape when it is not a box', () => {
    const graph = drawn(900, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 300, y: 0, width: 300, height: 300 }, { x: 600, y: 0, width: 300, height: 300 }]);
    const merged = run(graph, { kind: 'merge', ids: ['r1', 'r2', 'r3'] });
    expect(merged.graph.regions.map((r) => r.id)).toEqual(['r1']);
    expect(boxOf(merged.graph, 'r1')).toEqual({ x: 0, y: 0, width: 900, height: 300 });
    expect(merged.moves).toEqual({ r2: 'r1', r3: 'r1' });
    const l = drawn(400, 400, [{ x: 0, y: 0, width: 200, height: 400 }, { x: 200, y: 200, width: 200, height: 200 }]);
    const shaped = run(l, { kind: 'merge', ids: ['r1', 'r2'] });
    expect(findRegion(shaped.graph, 'r1')?.polygon).toHaveLength(6);
  });

  it('subtracts an area, leaving a cut-out shape or the bands around it', () => {
    const graph = drawn(300, 300, [{ x: 0, y: 0, width: 300, height: 300 }]);
    const bands = run(graph, { kind: 'subtract', ids: ['r1'], box: { x: 0, y: 100, width: 300, height: 100 } });
    expect(bands.graph.regions.map((r) => r.box)).toEqual([
      { x: 0, y: 0, width: 300, height: 100 },
      { x: 0, y: 200, width: 300, height: 100 },
    ]);
    const hole = run(graph, { kind: 'subtract', ids: ['r1'], box: { x: 100, y: 100, width: 100, height: 100 }, polygon: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 100, y: 200 }] });
    expect(findRegion(hole.graph, 'r1')?.holes).toHaveLength(1);
  });

  it('moves a structural line: dragging a shared boundary moves every region along it', () => {
    const graph = drawn(1000, 600, [
      { x: 0, y: 0, width: 300, height: 300 },
      { x: 0, y: 300, width: 300, height: 300 },
      { x: 300, y: 0, width: 700, height: 600 },
    ]);
    const boundary = topology(graph).boundaries.find((b) => b.axis === 'x' && b.at === 300 && b.regions.includes('r1') && b.regions.includes('r3'));
    expect(boundary).toBeDefined();
    const moved = run(graph, { kind: 'boundary', id: boundary?.id ?? '', at: 280 });
    expect(boxOf(moved.graph, 'r1')?.width).toBe(280);
    expect(boxOf(moved.graph, 'r2')?.width).toBe(280);
    expect(boxOf(moved.graph, 'r3')).toEqual({ x: 280, y: 0, width: 720, height: 600 });
  });

  it('moves a T-junction vertex along both of its lines', () => {
    const graph = drawn(600, 600, [
      { x: 0, y: 0, width: 300, height: 600 },
      { x: 300, y: 0, width: 300, height: 300 },
      { x: 300, y: 300, width: 300, height: 300 },
    ]);
    const vertex = topology(graph).vertices.find((v) => v.x === 300 && v.y === 300);
    const moved = run(graph, { kind: 'vertex', id: vertex?.id ?? '', point: { x: 250, y: 320 } });
    expect(boxOf(moved.graph, 'r1')?.width).toBe(250);
    expect(boxOf(moved.graph, 'r2')).toEqual({ x: 250, y: 0, width: 350, height: 320 });
    expect(boxOf(moved.graph, 'r3')).toEqual({ x: 250, y: 320, width: 350, height: 280 });
  });

  it('nests, detaches and extracts by changing the hierarchy, not only coordinates', () => {
    const graph = drawn(800, 400, [{ x: 0, y: 0, width: 800, height: 400 }]);
    const inner = run(graph, { kind: 'draw', region: { ...region('r2', { x: 50, y: 50, width: 100, height: 100 }), parent: 'r1' } }).graph;
    const deeper = run(inner, { kind: 'draw', region: { ...region('r3', { x: 60, y: 60, width: 20, height: 20 }), parent: 'r2' } }).graph;
    // detached where it stands, it would overlap the region it left: the hierarchy is checked, not only the tree
    expect(codes(execute(deeper, { kind: 'detach', ids: ['r3'] }))).toEqual(['overlap']);
    const out = run(deeper, { kind: 'compose', operations: [{ kind: 'move', ids: ['r3'], dx: 200, dy: 0 }, { kind: 'detach', ids: ['r3'] }] });
    expect(findRegion(out.graph, 'r3')?.parent).toBe('r1');
    expect(findRegion(run(out.graph, { kind: 'nest', ids: ['r3'], parent: 'r1' }).graph, 'r3')?.parent).toBe('r1');
    // extracted to the top level it would stand over r1, which the person did not ask for
    expect(codes(execute(deeper, { kind: 'extract', ids: ['r2'] }))).toEqual(['overlap']);
  });

  it('duplicates and repeats with fresh names and ids, copying the relations inside the copy', () => {
    const graph = drawn(1200, 300, [{ x: 0, y: 0, width: 200, height: 200 }]);
    const repeated = run(graph, { kind: 'repeat', id: 'r1', count: 4, axis: 'x', gap: 24 });
    expect(repeated.graph.regions.map((r) => [r.id, r.name, r.box.x])).toEqual([
      ['r1', 'Region 1', 0],
      ['r2', 'Region 1 2', 224],
      ['r3', 'Region 1 3', 448],
      ['r4', 'Region 1 4', 672],
    ]);
    const changed = run(repeated.graph, changeRepeat(repeated.graph, ['r1', 'r2', 'r3', 'r4'], 6, 'x', 24));
    expect(changed.graph.regions).toHaveLength(6);
    const fewer = run(repeated.graph, changeRepeat(repeated.graph, ['r1', 'r2', 'r3', 'r4'], 2, 'x', 24));
    expect(fewer.graph.regions.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(fewer.moves).toEqual({ r3: null, r4: null });
  });

  it('aligns and distributes, and refuses distributing fewer than three', () => {
    const graph = drawn(1000, 400, [{ x: 0, y: 0, width: 100, height: 100 }, { x: 300, y: 50, width: 100, height: 100 }, { x: 900, y: 20, width: 100, height: 100 }]);
    const aligned = run(graph, { kind: 'align', ids: ['r1', 'r2', 'r3'], axis: 'y', edge: 'start' });
    expect(aligned.graph.regions.map((r) => r.box.y)).toEqual([0, 0, 0]);
    const spread = run(graph, { kind: 'distribute', ids: ['r1', 'r2', 'r3'], axis: 'x' });
    expect(spread.graph.regions.map((r) => r.box.x)).toEqual([0, 450, 900]);
    expect(codes(execute(graph, { kind: 'distribute', ids: ['r1', 'r2'], axis: 'x' }))).toEqual(['distribute-count']);
  });

  it('deletes with what a region holds, and removes every reference to it', () => {
    const graph = drawn(900, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 300, y: 0, width: 300, height: 300 }, { x: 600, y: 0, width: 300, height: 300 }]);
    const related = run(graph, paintConstraint(graph, 'equal-size', ['r1', 'r2', 'r3'], 'x')).graph;
    const withRule = run(related, { kind: 'responsive', rule: { id: 'w1', maxWidth: 834, columns: 1, hidden: ['r2'], order: ['r3', 'r2', 'r1'] } }).graph;
    const deleted = run(withRule, { kind: 'delete', ids: ['r2'] });
    expect(deleted.graph.constraints[0]?.regions).toEqual(['r1', 'r3']);
    expect(deleted.graph.responsive[0]?.hidden).toEqual([]);
    expect(deleted.graph.responsive[0]?.order).toEqual(['r3', 'r1']);
    expect(deleted.moves).toEqual({ r2: null });
  });

  it('refuses to split, merge or reshape a content region (an element of the page, never a wrapper)', () => {
    const graph = drawn(600, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 300, y: 0, width: 300, height: 300 }], (r, i) => (i === 0 ? { ...r, kind: 'content' } : r));
    expect(codes(execute(graph, { kind: 'split', ids: ['r1'], axis: 'x', positions: [100] }))).toEqual(['cut-content']);
    expect(codes(execute(graph, { kind: 'merge', ids: ['r1', 'r2'] }))).toEqual(['merge-content']);
    expect(codes(execute(graph, { kind: 'nest', ids: ['r2'], parent: 'r1' }))).toEqual(['content-children']);
  });

  it('runs a compound operation as one, and its inverse is the graph it started from', () => {
    const graph = drawn(900, 300, [{ x: 0, y: 0, width: 900, height: 300 }]);
    const compound = run(graph, { kind: 'compose', operations: [{ kind: 'cut', from: { x: 300, y: -5 }, to: { x: 300, y: 305 } }, { kind: 'cut', from: { x: 600, y: -5 }, to: { x: 600, y: 305 } }] });
    expect(compound.graph.regions).toHaveLength(3);
    expect(compound.graph.revision).toBe(graph.revision + 1);
    expect(reverse(compound)).toBe(graph);
  });

  it('removes a shared boundary as a merge, duplicates it as a cut, and bends it into shapes', () => {
    const graph = drawn(600, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 300, y: 0, width: 300, height: 300 }]);
    const shared = topology(graph).boundaries.find((b) => b.regions.length === 2);
    expect(run(graph, editBoundary(graph, shared?.id ?? '', { kind: 'remove' })).graph.regions).toHaveLength(1);
    expect(run(graph, editBoundary(graph, shared?.id ?? '', { kind: 'duplicate', at: 150 })).graph.regions).toHaveLength(3);
    const bent = run(graph, editBoundary(graph, shared?.id ?? '', { kind: 'bend', point: { x: 340, y: 150 } }));
    expect(findRegion(bent.graph, 'r1')?.polygon).toHaveLength(5);
  });

  it('removes inert wrappers, cycles a selection through overlapping regions, and adds or toggles selections', () => {
    const graph = drawn(400, 400, [{ x: 0, y: 0, width: 400, height: 400 }]);
    const wrapped = run(graph, { kind: 'draw', region: { ...region('r2', { x: 0, y: 0, width: 400, height: 400 }), parent: 'r1' } }).graph;
    const cleaned = run(wrapped, removeRedundantWrappers(wrapped));
    expect(cleaned.graph.regions.map((r) => [r.id, r.parent])).toEqual([['r2', null]]);
    expect(cycleSelection(wrapped, { x: 10, y: 10 }, null)).toBe('r2');
    expect(cycleSelection(wrapped, { x: 10, y: 10 }, 'r2')).toBe('r1');
    expect(nextSelection(['a'], ['b'], 'add')).toEqual(['a', 'b']);
    expect(nextSelection(['a', 'b'], ['b'], 'toggle')).toEqual(['a']);
  });
});
