// The frame's edge (spec breakpoints-switch, the plan's stage 2): dragged, the width of the screen the canvas shows
// follows the pointer. The frame stays centred on the stage, so its edge keeps under the pointer when the width
// changes by twice the travel over the zoom; the zoom is the one at the press (a step naming no size starts from the
// width shown; the gesture is cancelled back to the press's width before each move, so Fit keeps its zoom while the
// drag lasts). The width is clamped to the screens the canvas shows; the breakpoint that holds it is the one the fields
// edit. Nothing in the document changes.
import { registerHandler } from '../../core/commands/registry.ts';
import { MAX_BREAKPOINT_WIDTH } from '../../core/document/breakpoints.ts';
import type { EditorUi } from '../state.ts';
import { MIN_VIEWPORT_WIDTH, showingWidth, viewportWidth } from './breakpoints.ts';
import { zoomOf } from './camera.ts';

export const resizeViewport = registerHandler<'view.resizeViewport', EditorUi>('view.resizeViewport', ({ state }, { size, distance }) => {
  const zoom = zoomOf(state);
  const width = Math.round((size ?? viewportWidth(state)) + (2 * distance) / (zoom > 0 ? zoom : 1));
  return showingWidth(state, Math.min(MAX_BREAKPOINT_WIDTH, Math.max(MIN_VIEWPORT_WIDTH, width)));
});
