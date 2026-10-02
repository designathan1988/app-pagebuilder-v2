import { describe, expect, it } from 'vitest';
import { handleOf, handleText, readStroke, type Stroke, type StrokeMode } from './recognize.ts';
import { DEFAULT_NAMING, execute } from './operations.ts';
import { emptyIntent, findRegion, type LayoutIntent, type Point } from '../intent/model.ts';
import { topology } from '../topology/topology.ts';
import { drawn } from '../testing/ports.ts';

const stroke = (points: Point[], mode: StrokeMode = 'auto', extra: Partial<Stroke> = {}): Stroke => ({ points, mode, handle: null, radius: 6, ...extra });
const read = (graph: LayoutIntent, s: Stroke) => readStroke(graph, s, DEFAULT_NAMING);
const after = (graph: LayoutIntent, s: Stroke): LayoutIntent => {
  const reading = read(graph, s);
  if (reading.result === null || !reading.result.ok) throw new Error(`no change: ${JSON.stringify(reading.problems)}`);
  return reading.result.graph;
};

describe('reading a stroke with the one tool', () => {
  it('draws a region in empty space, says its size, and predicts what it became', () => {
    const reading = read(emptyIntent(1200, 800), stroke([{ x: 0, y: 0 }, { x: 600, y: 50 }, { x: 1200, y: 100 }]));
    expect(reading.mode).toBe('draw');
    expect(reading.measurements).toEqual({ width: 1200, height: 100, dx: 1200, dy: 100 });
    expect(reading.area).toEqual({ x: 0, y: 0, width: 1200, height: 100 });
    expect(reading.prediction?.key).toBe('layout.predict.single');
    expect(reading.cursor).toBe('crosshair');
    expect(reading.result?.ok && reading.result.graph.regions[0]?.id).toBe('r1');
  });

  it('draws inside a region as its child', () => {
    const graph = drawn(1200, 800, [{ x: 0, y: 0, width: 1200, height: 800 }]);
    const reading = read(graph, stroke([{ x: 100, y: 100 }, { x: 300, y: 300 }], 'draw'));
    expect(reading.parent).toBe('r1');
    expect(reading.result?.ok && findRegion(reading.result.graph, 'r2')?.parent).toBe('r1');
  });

  it('cuts across a region from outside its edge, and a stroke that turns back cuts twice', () => {
    const graph = drawn(1200, 600, [{ x: 0, y: 0, width: 1200, height: 600 }]);
    const once = read(graph, stroke([{ x: 400, y: -10 }, { x: 400, y: 300 }, { x: 400, y: 610 }]));
    expect(once.mode).toBe('cut');
    expect(once.cuts).toHaveLength(1);
    expect(once.result?.ok && once.result.graph.regions.map((r) => r.box.width)).toEqual([400, 800]);
    const twice = after(graph, stroke([{ x: 400, y: -10 }, { x: 400, y: 610 }, { x: 800, y: 610 }, { x: 800, y: -10 }]));
    expect(twice.regions.map((r) => r.box.width)).toEqual([400, 400, 400]);
  });

  it('moves a region dragged by its label, nests it where it lands wholly inside another, and detaches it out of its parent', () => {
    const graph = drawn(1200, 600, [{ x: 0, y: 0, width: 600, height: 600 }, { x: 700, y: 100, width: 100, height: 100 }]);
    const label = { handle: { kind: 'move', id: 'r2' } } as const;
    const moved = read(graph, stroke([{ x: 750, y: 150 }, { x: 760, y: 160 }], 'auto', label));
    expect(moved.mode).toBe('move');
    const nested = read(graph, stroke([{ x: 750, y: 150 }, { x: 250, y: 250 }], 'auto', label));
    expect(nested.mode).toBe('nest');
    expect(nested.parent).toBe('r1');
    const inside = after(graph, stroke([{ x: 750, y: 150 }, { x: 250, y: 250 }], 'auto', label));
    expect(findRegion(inside, 'r2')?.parent).toBe('r1');
    const out = read(inside, stroke([{ x: 250, y: 250 }, { x: 950, y: 250 }], 'auto', label));
    expect(out.mode).toBe('nest');
    expect(out.result?.ok && findRegion(out.result.graph, 'r2')?.parent).toBeNull();
    // a selected region dragged by its body goes wherever it is dropped
    const body = read(graph, stroke([{ x: 750, y: 150 }, { x: 1000, y: 450 }], 'auto', { selected: ['r2'] }));
    expect(body.mode).toBe('move');
    expect(body.result?.ok && findRegion(body.result.graph, 'r2')?.box).toMatchObject({ x: 950, y: 400 });
    // a drag inside a region that is not selected draws a region inside it
    const child = read(graph, stroke([{ x: 100, y: 100 }, { x: 300, y: 300 }]));
    expect(child.mode).toBe('draw');
    expect(child.parent).toBe('r1');
  });

  it('erases the line between two regions rubbed along it, and resizes a region by its own edge', () => {
    const graph = drawn(1000, 400, [{ x: 0, y: 0, width: 300, height: 400 }, { x: 300, y: 0, width: 700, height: 400 }]);
    const rubbed = read(graph, stroke([{ x: 300, y: 50 }, { x: 302, y: 200 }, { x: 299, y: 350 }]));
    expect(rubbed.mode).toBe('merge');
    expect(rubbed.result?.ok && rubbed.result.graph.regions).toHaveLength(1);
    const alone = drawn(1000, 400, [{ x: 100, y: 100, width: 300, height: 200 }]);
    const wider = read(alone, stroke([{ x: 400, y: 200 }, { x: 523, y: 200 }]));
    expect(wider.mode).toBe('edge');
    expect(wider.result?.ok && wider.result.graph.regions[0]?.box).toEqual({ x: 100, y: 100, width: 423, height: 200 });
  });

  it('drags a shared boundary pressed on it, moving the regions on both sides', () => {
    const graph = drawn(1000, 400, [{ x: 0, y: 0, width: 300, height: 400 }, { x: 300, y: 0, width: 700, height: 400 }]);
    const reading = read(graph, stroke([{ x: 302, y: 200 }, { x: 280, y: 200 }]));
    expect(reading.mode).toBe('boundary');
    expect(reading.cursor).toBe('col-resize');
    expect(reading.result?.ok && reading.result.graph.regions.map((r) => r.box.width)).toEqual([280, 720]);
  });

  it('merges what a Shift sweep crosses and subtracts an Alt box, refusing what cannot be one region', () => {
    const graph = drawn(900, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 300, y: 0, width: 300, height: 300 }, { x: 600, y: 0, width: 300, height: 300 }]);
    const merged = read(graph, stroke([{ x: 100, y: 150 }, { x: 400, y: 150 }, { x: 700, y: 150 }], 'merge'));
    expect(merged.visited).toEqual(['r1', 'r2', 'r3']);
    expect(merged.result?.ok && merged.result.graph.regions).toHaveLength(1);
    const subtracted = read(graph, stroke([{ x: 300, y: 100 }, { x: 600, y: 200 }], 'subtract'));
    expect(subtracted.visited).toEqual(['r2']);
    expect(subtracted.area).toEqual({ x: 300, y: 100, width: 300, height: 100 });
  });

  it('selects with a marquee, groups with a lasso, and paints relations', () => {
    const graph = drawn(1000, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 350, y: 0, width: 300, height: 300 }, { x: 700, y: 0, width: 300, height: 300 }]);
    expect(read(graph, stroke([{ x: -5, y: -5 }, { x: 660, y: 310 }], 'select')).selection).toEqual(['r1', 'r2']);
    const lasso = read(graph, stroke([{ x: 50, y: 50 }, { x: 500, y: 20 }, { x: 600, y: 250 }, { x: 60, y: 280 }, { x: 52, y: 55 }], 'group'));
    expect(lasso.mode).toBe('group');
    expect(lasso.result?.ok && findRegion(lasso.result.graph, 'r1')?.parent).toBe('r4');
    const equalize = read(graph, stroke([{ x: 100, y: 150 }, { x: 500, y: 150 }, { x: 900, y: 150 }], 'relate'));
    expect(equalize.operation?.kind).toBe('constraint');
    const gap = read(graph, stroke([{ x: 100, y: 150 }, { x: 500, y: 150 }], 'relate'));
    expect(gap.operation?.kind === 'constraint' && gap.operation.constraint.kind).toBe('gap');
  });

  it('edits through handles: a gap for the whole line, a repetition by whole items', () => {
    const graph = drawn(1000, 300, [{ x: 0, y: 0, width: 200, height: 200 }, { x: 224, y: 0, width: 200, height: 200 }, { x: 448, y: 0, width: 200, height: 200 }]);
    const gap = after(graph, stroke([{ x: 212, y: 100 }, { x: 220, y: 100 }], 'auto', { handle: { kind: 'gap', id: 'x:r1:r2' } }));
    expect(gap.regions.map((r) => r.box.x)).toEqual([0, 232, 464]);
    const more = after(graph, stroke([{ x: 648, y: 100 }, { x: 648 + 448, y: 100 }], 'auto', { handle: { kind: 'repeat', id: 'r1' } }));
    expect(more.regions).toHaveLength(5);
    expect(handleOf(handleText({ kind: 'boundary', id: '$root:x:200:0:200' }))).toEqual({ kind: 'boundary', id: '$root:x:200:0:200' });
  });

  it('records responsive behaviour at a narrower width: a divider sets widths, a dragged region the order', () => {
    const graph = drawn(1200, 400, [{ x: 0, y: 0, width: 600, height: 400 }, { x: 600, y: 0, width: 600, height: 400 }]);
    const view = drawn(834, 400, [{ x: 0, y: 0, width: 417, height: 400 }, { x: 417, y: 0, width: 417, height: 400 }]);
    const boundary = topology(view).boundaries.find((b) => b.regions.length === 2);
    const sized = read(graph, stroke([{ x: 417, y: 200 }, { x: 300, y: 200 }], 'auto', { handle: { kind: 'boundary', id: boundary?.id ?? '' }, responsive: { maxWidth: 834, view } }));
    expect(sized.result?.ok && sized.result.graph.responsive[0]?.sizes).toEqual({ r1: { width: 300 }, r2: { width: 534 } });
    const ordered = read(graph, stroke([{ x: 100, y: 200 }, { x: 800, y: 200 }], 'auto', { responsive: { maxWidth: 834, view } }));
    expect(ordered.result?.ok && ordered.result.graph.responsive[0]?.order).toEqual(['r2', 'r1']);
    expect(execute(graph, ordered.operation ?? { kind: 'compose', operations: [] }).ok).toBe(true);
  });
});
