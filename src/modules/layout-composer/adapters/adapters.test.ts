import { describe, expect, it } from 'vitest';
import { recoverIntent, type MeasuredNode } from './recover.ts';
import { traceBlocks, traceLines, traceRegions, type Luminance } from './reference.ts';
import { propertyVocabulary } from './properties.ts';
import { DEFAULT_NAMING, execute } from '../gestures/operations.ts';
import { emptyIntent } from '../intent/model.ts';
import { validateIntent } from '../topology/topology.ts';

const node = (id: string, box: MeasuredNode['box'], styles: MeasuredNode['styles'] = {}, extra: Partial<MeasuredNode> = {}): MeasuredNode => ({ id, name: id, parent: null, box, tag: 'div', container: true, styles, responsive: {}, ...extra });

describe('recovering intent from an existing structure', () => {
  it('reads a flex row of a fixed sidebar and a growing content back as their sizing, with all evidence held', () => {
    const recovered = recoverIntent(
      [node('r1', { x: 0, y: 0, width: 280, height: 600 }, { flexBasis: '280px', flexGrow: '0' }), node('r2', { x: 280, y: 0, width: 920, height: 600 }, { flexGrow: '1', flexBasis: '0%' })],
      { x: 0, y: 0, width: 1200, height: 600 },
    );
    expect(recovered.graph.regions.map((r) => r.width.mode)).toEqual(['fluid', 'fluid']);
    expect(recovered.confidence).toBe(100);
    expect(validateIntent(recovered.graph)).toEqual([]);
  });

  it('reads the parent’s row, its gap and its narrow-width stacking into relations and rules', () => {
    const recovered = recoverIntent(
      [
        node('r1', { x: 0, y: 0, width: 1200, height: 400 }, { display: 'flex', columnGap: '24px', flexDirection: 'row' }, { responsive: { 834: { flexDirection: 'column' } } }),
        node('r2', { x: 0, y: 0, width: 588, height: 400 }, { flexBasis: '0%', flexGrow: '1' }, { parent: 'r1' }),
        node('r3', { x: 612, y: 0, width: 588, height: 400 }, { flexBasis: '0%', flexGrow: '1' }, { parent: 'r1', responsive: { 834: { display: 'none' } } }),
      ],
      { x: 0, y: 0, width: 1200, height: 400 },
    );
    expect(recovered.graph.regions.find((r) => r.id === 'r2')?.width).toEqual({ mode: 'fluid', weight: 1 });
    expect(recovered.graph.constraints).toEqual([{ id: 'c1', kind: 'gap', axis: 'x', regions: ['r2', 'r3'], value: 24 }]);
    expect(recovered.graph.responsive).toEqual([{ id: 'w1', maxWidth: 834, hidden: ['r3'], groups: { 'region:r1': { columns: 1 } } }]);
  });

  it('reports what it could not recover and how much it did: positioned, unknown sizing, empty', () => {
    const recovered = recoverIntent(
      [
        node('r1', { x: 0, y: 0, width: 600, height: 300 }, { position: 'absolute' }),
        node('r2', { x: 600, y: 0, width: 600, height: 300 }, { width: 'calc(50% - 1rem)' }),
        node('r3', { x: 0, y: 300, width: 1200, height: 0 }),
        node('t1', { x: 0, y: 320, width: 200, height: 40 }, {}, { container: false, tag: 'p' }),
      ],
      { x: 0, y: 0, width: 1200, height: 400 },
    );
    expect(recovered.ambiguities.map((a) => a.reason)).toEqual(['positioned', 'sizing', 'degenerate']);
    expect(recovered.confidence).toBe(81);
    expect(recovered.graph.regions.find((r) => r.id === 't1')?.kind).toBe('content');
  });

  it('keeps siblings the page draws on top of one another as an overlap the person asked for', () => {
    const recovered = recoverIntent([node('r1', { x: 0, y: 0, width: 600, height: 300 }), node('r2', { x: 300, y: 100, width: 600, height: 300 })], { x: 0, y: 0, width: 1200, height: 600 });
    expect(recovered.graph.regions.every((r) => r.overlap === true)).toBe(true);
    expect(validateIntent(recovered.graph)).toEqual([]);
  });
});

describe('tracing a reference image', () => {
  // a 120 × 80 wireframe: a dark header band, then a light sidebar and a white content area
  const image = (): Luminance => {
    const width = 120;
    const height = 80;
    const values = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) values[y * width + x] = y < 20 ? 0.1 : x < 30 ? 0.6 : 1;
    return { width, height, values };
  };

  it('finds the blocks by recursive cuts, and their edges as snap lines', () => {
    const blocks = traceBlocks(image(), { minimum: 10, depth: 4, contrast: 3 });
    expect(blocks).toEqual([
      { x: 0, y: 0, width: 120, height: 20 },
      { x: 0, y: 20, width: 30, height: 60 },
      { x: 30, y: 20, width: 90, height: 60 },
    ]);
    expect(traceLines(blocks, image(), { x: 0, y: 0, width: 1200, height: 800 })).toEqual({ x: [0, 300, 1200], y: [0, 200, 800] });
  });

  it('draws the traced blocks as regions in one operation', () => {
    const graph = emptyIntent(1200, 800);
    const op = traceRegions(graph, traceBlocks(image(), { minimum: 10, depth: 4, contrast: 3 }), image(), { x: 0, y: 0, width: 1200, height: 800 }, DEFAULT_NAMING);
    const result = execute(graph, op);
    expect(result.ok && result.graph.regions.map((r) => r.box)).toEqual([
      { x: 0, y: 0, width: 1200, height: 200 },
      { x: 0, y: 200, width: 300, height: 600 },
      { x: 300, y: 200, width: 900, height: 600 },
    ]);
  });
});

describe('the property vocabulary', () => {
  it('names each manifest property by its camelCase role', () => {
    expect(propertyVocabulary([{ id: 'grid-template-columns' }, { id: 'gap' }])).toEqual({ gridTemplateColumns: 'grid-template-columns', gap: 'gap' });
  });
});
