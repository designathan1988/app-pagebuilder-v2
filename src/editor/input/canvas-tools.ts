// The canvas tools of removable modules (src/modules/*, installed by src/app/modules.ts): a mode in which a module's
// own surface over the canvas takes the presses (the Layout Composer's drawing stage). The pointer owner (pointer.ts)
// stays the one owner of the pointer: it asks the installed tools first whether a primary press is theirs, and the tool
// that takes it gets the press's moves and its release; the editor's gesture is opened at the press, so the keys
// belong to the drag key context while the press lasts (Escape is drag.cancel), and what the release dispatches
// through it is one transaction and one undo step. Nothing here knows a module.
import type { Gesture } from '../../core/store/store.ts';
import type { KeyContextId } from '../../generated/ids.ts';
import type { EditorUi } from '../state.ts';
import type { EditorState, EditorStore } from '../store.ts';

export interface ToolPoint {
  // where the pointer is on the screen (client px)
  readonly x: number;
  readonly y: number;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly ctrl: boolean;
}

// One press a tool took, until its release or its cancellation.
export interface ToolSession {
  // the pointer moved while held: the tool draws what a release here would do (it dispatches nothing)
  move(at: ToolPoint): void;
  // the release: what the press means is dispatched through the gesture, which the pointer owner commits after
  release(at: ToolPoint, gesture: Gesture): void;
  // the press ended with nothing kept (Escape, a lost pointer)
  cancel(): void;
}

export interface CanvasTool {
  readonly id: string;
  // the press is this tool's (a session), or not (null: the pointer owner handles it as it would without the tool)
  press(at: ToolPoint, target: Element, state: EditorState, store: EditorStore): ToolSession | null;
  // the key context the canvas's keys are read in while the tool is on (its own Escape and Delete), or null
  keyContext(ui: EditorUi): KeyContextId | null;
}

const tools: CanvasTool[] = [];

// Installed once by each module that brings a tool; the function returned takes it away.
export function registerCanvasTool(tool: CanvasTool): () => void {
  if (tools.some((t) => t.id === tool.id)) throw new Error(`canvas tool ${tool.id} is installed twice`);
  tools.push(tool);
  return () => {
    const at = tools.indexOf(tool);
    if (at >= 0) tools.splice(at, 1);
  };
}

// The session of the first tool that takes the press, or null.
export function toolPress(at: ToolPoint, target: EventTarget | null, store: EditorStore): ToolSession | null {
  if (!(target instanceof Element)) return null;
  const state = store.getState();
  for (const tool of tools) {
    const session = tool.press(at, target, state, store);
    if (session !== null) return session;
  }
  return null;
}

// The key context of the canvas while a tool is on: the first installed tool's that has one (canvas/edit-mode.ts
// keyContextIn asks it), or null.
export function toolKeyContext(ui: EditorUi): KeyContextId | null {
  for (const tool of tools) {
    const context = tool.keyContext(ui);
    if (context !== null) return context;
  }
  return null;
}

export const toolPoint = (event: { clientX: number; clientY: number; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): ToolPoint => ({
  x: event.clientX,
  y: event.clientY,
  shift: event.shiftKey,
  alt: event.altKey,
  ctrl: event.ctrlKey || event.metaKey,
});
