import { describe, expect, it } from 'vitest';
import { canonicalBox, contains, distanceToEdge, hitRegions, intersection, polygonArea, quantize, splitBox, subtractBox } from './geometry.ts';
import { boxShape, polygonBoolean, segmentCuts, shapeArea, simpleRing } from './polygons.ts';
import { region } from '../intent/model.ts';

describe('the geometry of boxes', () => {
  it('splits a box at the places inside it, in order, and ignores the ones outside', () => {
    expect(splitBox({ x: 0, y: 0, width: 300, height: 100 }, 'x', [200, 100, 400, 0])).toEqual([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 100, y: 0, width: 100, height: 100 },
      { x: 200, y: 0, width: 100, height: 100 },
    ]);
  });

  it('subtracts a box into the bands around the cut, which tile the rest exactly', () => {
    const source = { x: 0, y: 0, width: 300, height: 300 };
    const parts = subtractBox(source, { x: 100, y: 100, width: 100, height: 100 });
    expect(parts).toHaveLength(4);
    expect(parts.reduce((s, b) => s + b.width * b.height, 0)).toBe(300 * 300 - 100 * 100);
    for (const p of parts) expect(intersection(p, { x: 100, y: 100, width: 100, height: 100 })).toBeNull();
  });

  it('keeps every committed coordinate on the precision grid, so repeated edits never drift', () => {
    let box = { x: 0.1, y: 0.2, width: 10.3, height: 7.7 };
    for (let i = 0; i < 1000; i += 1) box = canonicalBox({ ...box, x: box.x + 0.1, width: box.width - 0.1 + 0.1 });
    expect(box.x).toBe(quantize(box.x));
    expect(box.width).toBe(quantize(10.3));
  });

  it('hits the deepest region first, and never a hole of a shape', () => {
    const outer = region('a', { x: 0, y: 0, width: 400, height: 400 });
    const inner = { ...region('b', { x: 100, y: 100, width: 100, height: 100 }), parent: 'a' };
    expect(hitRegions([outer, inner], { x: 150, y: 150 }).map((r) => r.id)).toEqual(['b', 'a']);
    const ring = { ...region('c', { x: 0, y: 0, width: 300, height: 300 }), polygon: boxShape({ x: 0, y: 0, width: 300, height: 300 }).outer, holes: [boxShape({ x: 100, y: 100, width: 100, height: 100 }).outer] };
    expect(hitRegions([ring], { x: 150, y: 150 })).toEqual([]);
    expect(hitRegions([ring], { x: 50, y: 50 }).map((r) => r.id)).toEqual(['c']);
  });

  it('measures how far a point is from a box outline, inside or outside', () => {
    const b = { x: 0, y: 0, width: 100, height: 100 };
    expect(distanceToEdge({ x: 50, y: 10 }, b)).toBe(10);
    expect(distanceToEdge({ x: 130, y: 140 }, b)).toBe(50);
    expect(contains(b, { x: 10, y: 10, width: 90, height: 90 })).toBe(true);
  });
});

describe('the boolean operations of shapes', () => {
  it('keeps the area identity of union, intersection and difference over many pairs of boxes', () => {
    for (let i = 0; i < 40; i += 1) {
      const a = { x: (i * 37) % 200, y: (i * 53) % 150, width: 80 + ((i * 11) % 120), height: 60 + ((i * 7) % 90) };
      const b = { x: (i * 29) % 180, y: (i * 41) % 170, width: 70 + ((i * 13) % 110), height: 50 + ((i * 17) % 100) };
      const area = (op: 'union' | 'intersection' | 'difference') => polygonBoolean([boxShape(a)], [boxShape(b)], op).reduce((s, p) => s + shapeArea(p), 0);
      const both = intersection(a, b);
      const shared = both === null ? 0 : both.width * both.height;
      expect(area('intersection')).toBeCloseTo(shared, 4);
      expect(area('union')).toBeCloseTo(a.width * a.height + b.width * b.height - shared, 4);
      expect(area('difference')).toBeCloseTo(a.width * a.height - shared, 4);
    }
  });

  it('makes a hole when the cut lies inside, and cuts a sloped outline exactly', () => {
    const [donut] = polygonBoolean([boxShape({ x: 0, y: 0, width: 300, height: 300 })], [boxShape({ x: 100, y: 100, width: 100, height: 100 })], 'difference');
    expect(donut?.holes).toHaveLength(1);
    expect(shapeArea(donut as NonNullable<typeof donut>)).toBe(80000);
    const triangle = { outer: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 200 }], holes: [] };
    const cut = polygonBoolean([triangle], [boxShape({ x: 0, y: 0, width: 100, height: 200 })], 'intersection');
    expect(cut.reduce((s, p) => s + shapeArea(p), 0)).toBeCloseTo(15000, 6);
  });

  it('finds T junctions and collinear overlaps, and tells a simple ring from a crossed one', () => {
    expect(segmentCuts({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }, { a: { x: 50, y: 0 }, b: { x: 50, y: 50 } })).toEqual([0.5]);
    expect(segmentCuts({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }, { a: { x: 25, y: 0 }, b: { x: 75, y: 0 } })).toEqual([0.25, 0.75]);
    expect(simpleRing([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])).toBe(true);
    expect(simpleRing([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBe(false);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(50);
  });
});
