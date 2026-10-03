// The asset picker's state (INVENTORY.md, owners; spec explorer-assets-use; the user's real-use audit,
// 7.3): the panel that offers the project's image files where a field that names a file is written. Its state is
// editor state (ui.assetPicker: the attribute it writes, or null); nothing of it is document state. The view that
// draws the panel is shell/asset-picker.tsx; this module owns the two commands that open and close it.
import { registerHandler, type RegisteredHandler } from '../../core/commands/registry.ts';
import type { EditorUi } from '../state.ts';

export const openAssetPicker = registerHandler<'assetPicker.open', EditorUi>('assetPicker.open', ({ state }, { attribute }) => {
  if (state.ui.assetPicker !== null && state.ui.assetPicker.attribute === attribute) return { kind: 'change' };
  return { kind: 'change', ui: { ...state.ui, assetPicker: { attribute } } };
});

export const closeAssetPicker = registerHandler<'assetPicker.close', EditorUi>('assetPicker.close', ({ state }) =>
  state.ui.assetPicker === null ? { kind: 'change' } : { kind: 'change', ui: { ...state.ui, assetPicker: null } },
);

// Attribute writes remain with their owner; an accepted picker choice completes its UI interaction.
export function closingAssetPicker(owner: RegisteredHandler<'element.setAttribute', EditorUi>): RegisteredHandler<'element.setAttribute', EditorUi> {
  return {
    ...owner,
    run(context, args) {
      const outcome = owner.run(context, args);
      if (outcome.kind !== 'change' || context.state.ui.assetPicker === null) return outcome;
      return { ...outcome, ui: { ...(outcome.ui ?? context.state.ui), assetPicker: null } };
    },
  };
}
