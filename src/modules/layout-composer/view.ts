// The Layout Composer's editor side (src/app/modules-view.ts installs it): its sidebar view, its canvas layer and the
// canvas tool that takes the presses on its stage.
import { layoutTool } from './interaction/tool.ts';
import { LayoutOverlay } from './ui/overlay.tsx';
import { LayoutPanel } from './ui/panel.tsx';

export const LAYOUT_COMPOSER_VIEW = {
  sidebarViews: { 'layout-composer': LayoutPanel },
  canvasLayers: [LayoutOverlay],
  canvasTools: [layoutTool],
} as const;
