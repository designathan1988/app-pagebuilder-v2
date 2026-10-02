// The Layout Composer's editor side (src/app/modules-view.ts installs it): its sidebar view, its canvas layer and the
// canvas tools: the one that takes the presses on its stage, and the one that places a region dragged with the Select
// tool.
import { placeTool } from './interaction/place-tool.ts';
import { layoutTool } from './interaction/tool.ts';
import { LayoutOverlay } from './ui/overlay.tsx';
import { LayoutPanel } from './ui/panel.tsx';

export const LAYOUT_COMPOSER_VIEW = {
  sidebarViews: { 'layout-composer': LayoutPanel },
  canvasLayers: [LayoutOverlay],
  canvasTools: [layoutTool, placeTool],
} as const;
