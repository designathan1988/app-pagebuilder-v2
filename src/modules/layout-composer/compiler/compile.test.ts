import { describe, expect, it } from 'vitest';
import { compile, compiledKeys, ROOT_NODE, type CompiledNode } from './compile.ts';
import { execute } from '../gestures/operations.ts';
import { paintConstraint } from '../gestures/structural.ts';
import type { LayoutIntent } from '../intent/model.ts';
import { PORTS, drawn, property } from '../testing/ports.ts';

const css = (node: CompiledNode | undefined, role: string) => node?.styles[property(role)];
const find = (node: CompiledNode, key: string): CompiledNode | undefined => (node.key === key ? node : node.children.map((c) => find(c, key)).find((c) => c !== undefined));
const keys = (node: CompiledNode): string[] => [node.key, ...node.children.flatMap(keys)];
const ok = (graph: LayoutIntent, op: Parameters<typeof execute>[1]) => {
  const r = execute(graph, op);
  if (!r.ok) throw new Error(JSON.stringify(r.problems));
  return r.graph;
};

describe('the layout compiler', () => {
  it('compiles header, sidebar and content to one grid with named areas, no wrapper and no absolute positioning', () => {
    const graph = drawn(1200, 800, [
      { x: 0, y: 0, width: 1200, height: 100 },
      { x: 0, y: 100, width: 280, height: 700 },
      { x: 280, y: 100, width: 920, height: 700 },
    ], (r, i) => (i === 1 ? { ...r, width: { mode: 'fixed' } } : r));
    const { root, strategy } = compile(graph, PORTS);
    expect(root.key).toBe(ROOT_NODE);
    expect(strategy).toBe('grid');
    expect(root.children.map((c) => c.key)).toEqual(['r1', 'r2', 'r3']);
    expect(css(root, 'gridTemplateAreas')).toBe('"r1 r1" "r2 r3"');
    expect(css(root, 'gridTemplateColumns')).toBe('280px minmax(0, 1fr)');
    expect(css(root, 'gridTemplateRows')).toBe('minmax(100px, auto) minmax(700px, auto)');
    expect(JSON.stringify(root)).not.toContain('absolute');
  });

  it('compiles a sidebar beside its content to a row: 280px + Fill', () => {
    const graph = drawn(1200, 800, [{ x: 0, y: 0, width: 280, height: 800 }, { x: 280, y: 0, width: 920, height: 800 }], (r, i) => (i === 0 ? { ...r, width: { mode: 'fixed' } } : { ...r, width: { mode: 'fill-available' } }));
    const { root, strategy } = compile(graph, PORTS);
    expect(strategy).toBe('flex');
    expect(css(root, 'flexDirection')).toBe('row');
    expect(css(find(root, 'r1'), 'flexBasis')).toBe('280px');
    expect(css(find(root, 'r1'), 'flexGrow')).toBe('0');
    expect(css(find(root, 'r2'), 'flexGrow')).toBe('1');
    expect(css(find(root, 'r1'), 'minHeight')).toBe('800px');
  });

  it('gives fluid columns their shares of the row, and an equal gap as one gap', () => {
    const graph = drawn(1000, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 324, y: 0, width: 300, height: 300 }, { x: 648, y: 0, width: 300, height: 300 }]);
    const { root } = compile(graph, PORTS);
    expect(root.children.map((c) => css(c, 'flexGrow'))).toEqual(['1', '1', '1']);
    expect(root.styles[property('gap')]).toBe('24px');
  });

  it('writes a gap that names a layout variable as the design token when the project has one', () => {
    const base = drawn(1000, 300, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 324, y: 0, width: 300, height: 300 }]);
    const graph = ok({ ...base, variables: { cardGap: 24 } }, paintConstraint({ ...base, variables: { cardGap: 24 } }, 'gap', ['r1', 'r2'], 'x', 'cardGap'));
    expect(compile(graph, PORTS).root.styles[property('gap')]).toBe('24px');
    expect(compile(graph, { ...PORTS, variable: (name) => `var(--${name})` }).root.styles[property('gap')]).toBe('var(--cardGap)');
  });

  it('compiles a pinwheel (no guillotine cut) to a grid with named areas and no empty wrappers', () => {
    const graph = drawn(300, 300, [
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 200, y: 0, width: 100, height: 200 },
      { x: 100, y: 200, width: 200, height: 100 },
      { x: 0, y: 100, width: 100, height: 200 },
      { x: 100, y: 100, width: 100, height: 100 },
    ]);
    const { root, strategy } = compile(graph, PORTS);
    expect(strategy).toBe('grid');
    expect(root.children).toHaveLength(5);
    expect(css(root, 'gridTemplateAreas')).toBe('"r1 r1 r2" "r4 r5 r2" "r4 r3 r3"');
    expect(root.children.every((c) => c.children.length === 0)).toBe(true);
  });

  it('turns uniform empty tracks between cells into the grid gap', () => {
    const graph = ok(
      drawn(648, 300, [{ x: 0, y: 0, width: 200, height: 138 }, { x: 224, y: 0, width: 200, height: 138 }, { x: 448, y: 0, width: 200, height: 138 }, { x: 0, y: 162, width: 200, height: 138 }, { x: 224, y: 162, width: 200, height: 138 }, { x: 448, y: 162, width: 200, height: 138 }]),
      { kind: 'interpret', parent: null, strategy: 'grid' },
    );
    const { root } = compile(graph, PORTS);
    // the track list as its owner writes it (src/core/style/tracks.ts)
    expect(css(root, 'gridTemplateColumns')).toBe('repeat(3, minmax(0, 1fr))');
    expect(root.styles[property('gap')]).toBe('24px 24px');
  });

  it('reflows the top level at a responsive rule and hides, orders and sizes regions there', () => {
    const base = drawn(1200, 300, [{ x: 0, y: 0, width: 400, height: 300 }, { x: 400, y: 0, width: 400, height: 300 }, { x: 800, y: 0, width: 400, height: 300 }]);
    const graph = ok(base, { kind: 'responsive', rule: { id: 'w1', maxWidth: 834, columns: 1, gap: 16, hidden: ['r2'], order: ['r3', 'r1'] } });
    const { root, breakpoints } = compile(graph, PORTS);
    expect(breakpoints).toEqual([{ id: 'w1', maxWidth: 834 }]);
    expect(root.responsive.w1?.[property('flexDirection')]).toBe('column');
    expect(root.responsive.w1?.[property('gap')]).toBe('16px');
    expect(find(root, 'r2')?.responsive.w1?.[property('display')]).toBe('none');
    expect(find(root, 'r3')?.responsive.w1?.[property('order')]).toBe('0');
    expect(find(root, 'r1')?.responsive.w1?.[property('flexBasis')]).toBe('auto');
  });

  it('writes a morph as native clamp() curves, the widest segment as the declaration', () => {
    const base = drawn(1440, 300, [{ x: 0, y: 0, width: 280, height: 300 }, { x: 280, y: 0, width: 1160, height: 300 }], (r, i) => (i === 0 ? { ...r, width: { mode: 'fixed' } } : r));
    const graph = ok(base, { kind: 'morph', morph: { id: 'm1', region: 'r1', property: 'width', points: [{ width: 390, value: 200 }, { width: 834, value: 220 }, { width: 1440, value: 280 }] } });
    const { root, breakpoints } = compile(graph, PORTS);
    const sidebar = find(root, 'r1');
    expect(css(sidebar, 'flexBasis')).toMatch(/^clamp\(220px, calc\(.+px \+ .+vw\), 280px\)$/);
    expect(sidebar?.responsive['morph:m1:834']?.[property('flexBasis')]).toMatch(/^clamp\(200px/);
    expect(breakpoints).toContainEqual({ id: 'morph:m1:834', maxWidth: 834 });
  });

  it('clips a shape with a percentage polygon and keeps holes with the even-odd rule', () => {
    const base = drawn(300, 300, [{ x: 0, y: 0, width: 300, height: 300 }]);
    const graph = ok(base, { kind: 'subtract', ids: ['r1'], box: { x: 100, y: 100, width: 100, height: 100 }, polygon: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 100, y: 200 }] });
    const clip = css(find(compile(graph, PORTS).root, 'r1'), 'clipPath');
    expect(clip).toMatch(/^polygon\(evenodd, /);
  });

  it('prefers the structure that keeps the nodes the page holds (stable compilation)', () => {
    const graph = drawn(600, 600, [{ x: 0, y: 0, width: 300, height: 300 }, { x: 300, y: 0, width: 300, height: 300 }, { x: 0, y: 300, width: 300, height: 300 }, { x: 300, y: 300, width: 300, height: 300 }]);
    const columnsFirst = compile(graph, PORTS, { previous: new Set([ROOT_NODE, 'group:r1+r3', 'group:r2+r4', 'r1', 'r2', 'r3', 'r4']) });
    expect(keys(columnsFirst.root)).toContain('group:r1+r3');
    const rowsFirst = compile(graph, PORTS, { previous: new Set([ROOT_NODE, 'group:r1+r2', 'group:r3+r4', 'r1', 'r2', 'r3', 'r4']) });
    expect(keys(rowsFirst.root)).toContain('group:r1+r2');
    expect(compiledKeys(rowsFirst.root).size).toBe(7);
  });

  it('never compiles an invalid intent', () => {
    const graph = drawn(600, 300, [{ x: 0, y: 0, width: 400, height: 300 }, { x: 200, y: 0, width: 400, height: 300 }]);
    expect(() => compile(graph, PORTS)).toThrow();
  });
});
