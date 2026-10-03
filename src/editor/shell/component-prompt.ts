// The component name prompt (INVENTORY.md, owners; spec reusable-components; the user's real-use audit,
// item A3.12): "Create a component" asks the name first, so a component is named by the person and its instances are
// named after it. Its state is editor state (ui.componentPrompt: the element the component is being made from, or
// null); nothing of it is document state. The view that draws it is shell/component-prompt.tsx, whose field hands
// components.create the name typed; this module owns the two commands that open it and close it.
import { message, registerHandler } from '../../core/commands/registry.ts';
import { createRefusal } from '../../core/design/components.ts';
import type { NodeId } from '../../core/document/model.ts';
import type { EditorUi } from '../state.ts';

export const openComponentPrompt = registerHandler<'components.startCreate', EditorUi>('components.startCreate', ({ state }, { target }) => {
  const node = (target as NodeId | undefined) ?? state.selection[0];
  if (node === undefined) return { kind: 'refused', message: message('status.needsSingleSelection') };
  // the prompt opens where a component can be made (the create's own answer, so a door never opens a dead end)
  const refused = createRefusal(state.document, node);
  if (refused !== null) return { kind: 'refused', message: refused };
  if (state.ui.componentPrompt?.node === node) return { kind: 'change' };
  return { kind: 'change', ui: { ...state.ui, componentPrompt: { node } } };
});

export const closeComponentPrompt = registerHandler<'components.closePrompt', EditorUi>('components.closePrompt', ({ state }) =>
  state.ui.componentPrompt === null ? { kind: 'change' } : { kind: 'change', ui: { ...state.ui, componentPrompt: null } },
);
