// What the 2026-10-02 review of the Layout Composer found, each held here: a layout drawn by hand compiles to clean
// CSS, stacks on a tablet and a phone in reading order, keeps what the person chose, and the widths check sees a
// squeezed column; strokes snap, a box from outside selects, a slanted drag never cuts.
import { describe, expect, it } from 'vitest';
import { compile, type CompiledNode } from '../compiler/compile.ts';
import { readStroke, type Stroke } from '../gestures/recognize.ts';
import { DEFAULT_NAMING, execute } from '../gestures/operations.ts';
import { stress } from '../intent/analysis.ts';
import type { LayoutIntent, Point } from '../intent/model.ts';
import { PORTS, drawn, property } from '../testing/ports.ts';
import { adaptationFor, responsiveEdit, withAdaptation } from './continuum.ts';

const css = (node: CompiledNode | undefined, role: string) => node?.styles[property(role)];
const ADAPT = adaptationFor([
  { id: 'desktop', maxWidth: 1440, base: true },
  { id: 'laptop', maxWidth: 1180, base: false },
  { id: 'tablet', maxWidth: 834, base: false },
  { id: 'phone', maxWidth: 390, base: false },
]);
const ok = (graph: LayoutIntent, op: Parameters<typeof execute>[1]) => {
  const r = execute(graph, op);
  if (!r.ok) throw new Error(JSON.stringify(r.problems));
  return r.graph;
};
const stroke = (points: Point[], extra: Partial<Stroke> = {}): Stroke => ({ points, mode: 'auto', handle: null, radius: 8, ...extra });

// the four blocks of the review, as a hand drew them: every edge a few pixels off the one beside it
const byHand = () =>
  drawn(1440, 900, [
    { x: 37, y: 33, width: 1367, height: 98 },
    { x: 41, y: 163, width: 306, height: 549 },
    { x: 378, y: 158, width: 1020, height: 558 },
    { x: 39, y: 748, width: 1362, height: 114 },
  ]);

describe('a layout drawn by hand', () => {
  it('compiles to whole pixels, one gap and no sliver tracks', () => {
    const { root } = compile(byHand(), PORTS);
    const text = JSON.stringify(root);
    // no fraction of a pixel and no share with more than two decimals anywhere
    expect(text).not.toMatch(/\d+\.\d+px/);
    expect(text).not.toMatch(/\d+\.\d{3,}fr/);
    // edges a few pixels apart are one line: no track of a few pixels between them
    const tracks = [css(root, 'gridTemplateColumns'), css(root, 'gridTemplateRows')].join(' ');
    expect(tracks).not.toMatch(/\b[0-9]px/);
    // the header and the footer span the whole width
    expect(css(root, 'gridTemplateAreas') ?? '').not.toMatch(/"\. | \."/);
  });

  it('stands in reading order whatever order it was drawn in', () => {
    const shuffled = drawn(1200, 800, [
      { x: 0, y: 700, width: 1200, height: 100 },
      { x: 300, y: 100, width: 900, height: 576 },
      { x: 0, y: 0, width: 1200, height: 76 },
      { x: 0, y: 100, width: 276, height: 576 },
    ]);
    const { root } = compile(shuffled, PORTS);
    // the region drawn first is the footer: it stands last
    const order = (node: CompiledNode): string[] => node.children.flatMap((c) => (c.region === null ? order(c) : [c.region]));
    expect(order(root)).toEqual(['r3', 'r4', 'r2', 'r1']);
  });

  it('drops the drawn height of a region once it holds content of its own', () => {
    const graph = drawn(1200, 800, [{ x: 0, y: 0, width: 1200, height: 300 }, { x: 0, y: 324, width: 1200, height: 476 }]);
    const empty = compile(graph, PORTS).root.children.find((c) => c.region === 'r1');
    const filled = compile(graph, PORTS, { filled: new Set(['r1']) }).root.children.find((c) => c.region === 'r1');
    expect(css(empty, 'minHeight')).toBe('300px');
    expect(css(filled, 'minHeight')).toBeUndefined();
  });
});

describe('the automatic reflow at narrower screens', () => {
  it('stacks what stands side by side at the tablet width, and nothing wider', () => {
    const laid = withAdaptation(byHand(), ADAPT);
    expect(ADAPT).toEqual({ tablet: 834, phone: 390 });
    const rule = laid.responsive.find((r) => r.maxWidth === 834);
    expect(rule?.columns).toBe(1);
    expect(laid.responsive.some((r) => r.maxWidth > 834)).toBe(false);
    const { root, breakpoints } = compile(laid, PORTS);
    expect(breakpoints.map((b) => b.maxWidth)).toContain(834);
    expect(Object.values(root.responsive)[0]?.[property('display')]).toBe('flex');
  });

  it('flows three alike cards in two columns on a tablet and one on a phone', () => {
    const cards = drawn(1200, 400, [0, 1, 2].map((i) => ({ x: i * 408, y: 0, width: 384, height: 400 })));
    const laid = withAdaptation(cards, ADAPT);
    expect(laid.responsive.find((r) => r.maxWidth === 834)?.columns).toBe(2);
    expect(laid.responsive.find((r) => r.maxWidth === 390)?.columns).toBe(1);
  });

  it('leaves a column of regions one under the other as it is', () => {
    const column = drawn(1200, 800, [{ x: 0, y: 0, width: 1200, height: 300 }, { x: 0, y: 324, width: 1200, height: 476 }]);
    expect(withAdaptation(column, ADAPT).responsive).toEqual([]);
  });

  it('keeps what the person chose: kept as drawn on a tablet, or stacked only on a phone', () => {
    const graph = byHand();
    const kept = ok(graph, responsiveEdit(graph, 834, { kind: 'unstack', parent: null }));
    expect(kept.responsive[0]?.kept).toEqual(['$root']);
    expect(withAdaptation(kept, ADAPT).responsive.find((r) => r.maxWidth === 834)?.columns).toBeUndefined();
    const phoneOnly = ok(graph, responsiveEdit(graph, 390, { kind: 'stack', parent: null }));
    // a choice at the phone width leaves the tablet to the automatic reflow
    expect(withAdaptation(phoneOnly, ADAPT).responsive.find((r) => r.maxWidth === 834)?.columns).toBe(1);
  });

  it('is what the widths check measures: four columns squeeze without it, hold with it', () => {
    const four = drawn(1440, 600, [0, 1, 2, 3].map((i) => ({ x: i * 360, y: 0, width: 340, height: 600 })));
    const at = [834, 390].map((width) => ({ width, scale: 1, content: {} }));
    const squeezed = stress(four, at).filter((i) => i.kind === 'squeezed');
    expect(squeezed.map((i) => i.viewport)).toContain(390);
    expect(stress(withAdaptation(four, ADAPT), at).filter((i) => i.kind === 'squeezed')).toEqual([]);
  });
});

describe('strokes that snap, select and cut', () => {
  it('snaps a drawn box to the edges near it and says which lines', () => {
    const graph = drawn(1440, 900, [{ x: 40, y: 40, width: 1360, height: 100 }]);
    const reading = readStroke(graph, stroke([{ x: 45, y: 163 }, { x: 1396, y: 700 }]), DEFAULT_NAMING);
    expect(reading.mode).toBe('draw');
    expect(reading.area).toMatchObject({ x: 40, width: 1360 });
    expect(reading.guides.some((g) => g.axis === 'x' && g.at === 40)).toBe(true);
  });

  it('selects the regions a box from outside holds, and changes nothing', () => {
    const graph = drawn(1440, 900, [{ x: 40, y: 40, width: 600, height: 400 }, { x: 680, y: 40, width: 600, height: 400 }]);
    const reading = readStroke(graph, stroke([{ x: 10, y: 10 }, { x: 1300, y: 460 }]), DEFAULT_NAMING);
    expect(reading.mode).toBe('select');
    expect(reading.selection).toEqual(['r1', 'r2']);
    expect(reading.operation).toBeNull();
  });

  it('never reads a slanted drag across a region as a cut', () => {
    const graph = drawn(1440, 900, [{ x: 40, y: 40, width: 1360, height: 560 }]);
    const reading = readStroke(graph, stroke([{ x: 300, y: 20 }, { x: 900, y: 880 }]), DEFAULT_NAMING);
    expect(reading.mode).not.toBe('cut');
    const straight = readStroke(graph, stroke([{ x: 500, y: 20 }, { x: 505, y: 620 }]), DEFAULT_NAMING);
    expect(straight.mode).toBe('cut');
  });

  it('snaps a moved region to its neighbour', () => {
    const graph = drawn(1440, 900, [{ x: 40, y: 40, width: 400, height: 300 }, { x: 600, y: 400, width: 400, height: 300 }]);
    const reading = readStroke(graph, stroke([{ x: 800, y: 550 }, { x: 645, y: 550 }]), DEFAULT_NAMING);
    expect(reading.mode).toBe('move');
    // dragged 155 px left: its left edge lands 5 px from the first region's right edge, and snaps onto it
    expect(reading.area?.x).toBe(440);
    expect(reading.guides).toContainEqual({ axis: 'x', at: 440 });
  });
});
