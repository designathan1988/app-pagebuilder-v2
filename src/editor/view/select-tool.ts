// The Select tool (view.selectTool: the canvas toolbar's first tool, and V): the editor's ordinary way of working,
// where a click selects and a drag moves or resizes what is selected. Choosing it puts away whatever other tool the
// canvas held: a module's tool (the Layout Composer keeps its intent in the document, so leaving it loses nothing)
// and the grid edit mode. It is current while no other tool is.
import { message, registerHandler } from '../../core/commands/registry.ts';
import type { EditorUi } from '../state.ts';

// the editor state with no tool but Select
function selecting(ui: EditorUi): EditorUi {
  const { modules: _modules, gridEdit: _gridEdit, ...rest } = ui;
  void _modules;
  void _gridEdit;
  return rest;
}

const otherTool = (ui: EditorUi): boolean => Object.keys(ui.modules ?? {}).length > 0 || ui.gridEdit !== undefined;

export const selectTool = registerHandler<'view.selectTool', EditorUi>(
  'view.selectTool',
  ({ state }) => (otherTool(state.ui) ? { kind: 'change', ui: selecting(state.ui), message: message('status.tool.select') } : { kind: 'change', message: message('status.tool.select') }),
  (state) => !otherTool(state.ui),
);
