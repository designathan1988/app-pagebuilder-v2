// The editor side of the installed modules (src/app/modules.ts lists them): the sidebar views they draw, the layers
// they draw over the canvas and the canvas tools that take presses there (editor/input/pointer-tools.ts).
import type { ComponentType } from 'react';
import { registerPointerTool, type PointerTool } from '../editor/input/pointer-tools.ts';
import type { BodyTable } from '../editor/shell/bodies.ts';
import { LAYOUT_COMPOSER_VIEW } from '../modules/layout-composer/view.ts';

// what the editor asks of a module's editor side
interface ModuleView {
  readonly sidebarViews: BodyTable;
  readonly canvasLayers: readonly ComponentType[];
  readonly canvasTools: readonly PointerTool[];
}

const INSTALLED: readonly ModuleView[] = [LAYOUT_COMPOSER_VIEW];

export const MODULE_SIDEBAR_VIEWS: BodyTable = Object.assign({}, ...INSTALLED.map((m) => m.sidebarViews)) as BodyTable;
export const MODULE_CANVAS_LAYERS: readonly ComponentType[] = INSTALLED.flatMap((m) => m.canvasLayers);

// The canvas tools join the pointer owner once, when the editor starts (main.tsx); the function returned takes them away.
export function installModuleTools(): () => void {
  const removals = INSTALLED.flatMap((m) => m.canvasTools.map((tool) => registerPointerTool(tool)));
  return () => {
    for (const remove of removals) remove();
  };
}
