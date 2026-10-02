import { describe, expect, it } from 'vitest';
import { LENSES, describeConstraint, inspect, scene } from './scene.ts';
import { execute } from '../gestures/operations.ts';
import { paintConstraint } from '../gestures/structural.ts';
import { drawn } from '../testing/ports.ts';

describe('what the overlay and the intent inspector show', () => {
  const cards = drawn(1000, 300, [0, 1, 2].map((i) => ({ x: i * 224, y: 0, width: 200, height: 200 })));

  it('labels regions by lens and shows the handles the selection’s structure has', () => {
    for (const lens of LENSES) expect(scene(cards, [], lens).regions).toHaveLength(3);
    const selected = scene(cards, ['r2'], 'spatial');
    expect(selected.regions.find((r) => r.id === 'r2')?.selected).toBe(true);
    const kinds = selected.handles.map((h) => h.kind).sort();
    expect(kinds).toEqual(['gap', 'gap', 'repeat']);
    expect(selected.handles.find((h) => h.kind === 'repeat')?.id).toBe('repeat:r1');
    expect(scene(cards, [], 'semantic').regions[0]?.label).toEqual({ key: 'layout.label.semantic', params: { name: 'Region 1', semantic: 'div' } });
  });

  it('draws the relations in the constraints lens, in words', () => {
    const related = execute(cards, paintConstraint(cards, 'gap', ['r1', 'r2', 'r3'], 'x', 24));
    if (!related.ok) throw new Error('refused');
    const drawnRelations = scene(related.graph, [], 'constraints').relations;
    expect(drawnRelations).toHaveLength(2);
    expect(describeConstraint(related.graph, related.graph.constraints[0] as (typeof related.graph.constraints)[number])).toEqual({ key: 'layout.constraint.gap', params: { regions: 'Region 1, Region 2, Region 3', value: 24 } });
  });

  it('inspects intent, not CSS: behaviour, columns, minimum item width, gap, sizing and what happens when narrow', () => {
    const model = inspect(cards, null);
    expect(model?.behavior).toEqual({ key: 'layout.predict.columns', params: { count: 3, gap: 24, sizing: 'fluid' } });
    expect(model?.columns).toBe(3);
    expect(model?.minimum).toBe(200);
    expect(model?.gap).toBe(24);
    expect(model?.narrow).toBe('keep');
    const stacked = execute(cards, { kind: 'responsive', rule: { id: 'w1', maxWidth: 390, columns: 1, hidden: [] } });
    expect(stacked.ok && inspect(stacked.graph, null)?.narrow).toBe('stack');
    expect(inspect(cards, 'missing')).toBeNull();
  });
});
