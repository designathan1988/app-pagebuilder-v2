// The composer's editor state, kept in the editor's own store under the module's namespace (EditorUi.modules): which
// container is composed, which regions are selected, the lens and the tool. It is never document state: leaving the
// composer, or removing the module, leaves nothing behind but the document the composer wrote.
import type { NodeId } from '../../../core/document/model.ts';
import type { EditorUi } from '../../../editor/state.ts';
import type { StrokeMode } from '../gestures/recognize.ts';
import type { Lens } from '../ui/scene.ts';
import { NAMESPACE } from './record.ts';

export interface ComposerState {
  readonly target: NodeId;
  readonly selection: readonly string[];
  readonly lens: Lens;
  readonly tool: StrokeMode;
}

export const composerOf = (ui: EditorUi): ComposerState | null => (ui.modules?.[NAMESPACE] as ComposerState | undefined) ?? null;

export function withComposer(ui: EditorUi, value: ComposerState | null): EditorUi {
  const { [NAMESPACE]: _dropped, ...others } = ui.modules ?? {};
  void _dropped;
  const modules = value === null ? others : { ...others, [NAMESPACE]: value };
  const { modules: _old, ...rest } = ui;
  void _old;
  return Object.keys(modules).length === 0 ? rest : { ...rest, modules };
}
