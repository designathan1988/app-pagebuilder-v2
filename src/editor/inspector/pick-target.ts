// The target an interaction is being given (PRODUCT.md §5; spec events-actions; PRODUCT.md §5.3: "the Target field
// starts picking (not a command); the target is picked on the canvas or on a Layers row"). `ui.pickTarget` names which
// interaction of the selected element the next press answers: the Target field's door starts it (interactions.update
// with `changes.pick`), the press on the canvas (`#canvas-click-pick-target`) or on a Layers row
// (`#layers-row-pick-target`) runs the command with the node it landed on and clears it, and so does another
// selection (the editor state that follows a selection keeps no picker). Never a document change of its own.
import type { EditorUi } from '../state.ts';

export const pickingTarget = (ui: EditorUi): number | null => ui.pickTarget ?? null;

// the editor state with the pick started, and the one with it cleared (interactions.update runs both: the Target
// field starts it, the pick itself ends it)
export const makePicking = <Ui extends { readonly pickTarget?: number | undefined }>(ui: Ui, interaction: number): Ui => ({ ...ui, pickTarget: interaction });
export function makePicked<Ui extends { readonly pickTarget?: number | undefined }>(ui: Ui): Ui {
  if (ui.pickTarget === undefined) return ui;
  const { pickTarget: _dropped, ...rest } = ui;
  void _dropped;
  return rest as Ui;
}
