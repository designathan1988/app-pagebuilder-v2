// Every ready-made value of properties.json is a value its property takes (spec value-presets): applied on the real
// store through the command its thumbnail runs, it is written, one undo step.
import { describe, expect, it } from 'vitest';
import fixture from '../../../manifest/features/fixtures/responsive-title.json';
import type { DocumentJson } from '../../core/document/model.ts';
import type { CommandId } from '../../generated/ids.ts';
import { manifest } from '../../manifest/runtime.ts';
import { createEditorStore } from '../store.ts';

const targets = [...manifest.properties.properties, ...manifest.properties.composites].filter((target) => (target.presets ?? []).length > 0);
const presetDoors = manifest.doors.filter((d) => d.door.kind === 'panel-control' && d.door.control === 'value-preset');

describe('value presets', () => {
  it('offers some, each named', () => {
    expect(targets.map((t) => t.id).sort()).toEqual(['border-radius', 'box-shadow', 'opacity']);
  });
  for (const target of targets) {
    for (const preset of target.presets ?? []) {
      it(`${target.id} ${preset.id} is written, one undo step`, () => {
        const store = createEditorStore({ storage: { read: () => null, write: () => {} }, freeze: true, ports: { css: { supports: () => true } } as never, restored: { document: fixture as unknown as DocumentJson, selection: ['n-title' as never] } });
        const own = presetDoors.find((d) => d.command.args.property?.values.includes(target.id) === true);
        const door = own ?? presetDoors.find((d) => d.command.args.property?.type === 'property');
        if (door === undefined) throw new Error('no preset door');
        const args = own !== undefined ? { property: target.id, edit: { css: preset.value } } : { property: target.id, value: preset.value };
        expect(store.dispatch(door.command.id as CommandId, args as never).status).toBe('done');
        expect(store.getState().history.past).toHaveLength(1);
      });
    }
  }
});
