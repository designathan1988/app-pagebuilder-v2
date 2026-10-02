// The pointer tools: a surface of the editor that takes the presses on it for a drag of its own — a removable module's
// canvas tool (the Layout Composer's drawing stage), a panel's drags (the motion Timeline's bars, keyframes, markers
// and playhead). The pointer owner (pointer.ts) stays the one owner of the pointer: it asks the installed tools first
// whether a primary press is theirs, and the tool that takes it gets the press's moves and its release. The editor's
// gesture is opened at the press, so the keys belong to the drag key context while the press lasts (Escape is
// drag.cancel), and what runs through it is one transaction and one undo step:
//  - a move may name a command and its arguments: the gesture is cancelled back to the press and runs it anew, so the
//    page follows the pointer and Escape puts everything back (a bar dragged along the Timeline);
//  - the release runs what the press means through the gesture (a stroke read whole), which the pointer owner then
//    commits.
// Nothing here knows a tool.
import type { Gesture } from '../../core/store/store.ts';
import type { CommandId, KeyContextId } from '../../generated/ids.ts';
import type { EditorUi } from '../state.ts';
import type { EditorState, EditorStore } from '../store.ts';

export interface ToolPoint {
  // where the pointer is on the screen (client px)
  readonly x: number;
  readonly y: number;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly ctrl: boolean;
  // the letters held (upper case): a letter held through a drag is a spring-loaded tool (the Layout tool's S and M)
  readonly letters: readonly string[];
}

// The letters held now: the keymap, which owns the keys, says when one goes down and when it is let go (or the window
// loses the focus, and every key with it).
const letters = new Set<string>();
export function holdLetter(key: string, down: boolean): void {
  if (key.length !== 1) return;
  if (down) letters.add(key.toUpperCase());
  else letters.delete(key.toUpperCase());
}
export function releaseLetters(): void {
  letters.clear();
}

// a command a move runs, with its arguments
export interface ToolDispatch {
  readonly command: CommandId;
  readonly args: Readonly<Record<string, unknown>>;
}

// One press a tool took, until its release or its cancellation.
export interface ToolSession {
  // the pointer moved while held: the command the drag runs at this point, or null when the tool only draws (a
  // preview of its own)
  move(at: ToolPoint): ToolDispatch | null;
  // the release: what the press means is dispatched through the gesture, which the pointer owner commits after
  release(at: ToolPoint, gesture: Gesture): void;
  // the press ended with nothing kept (Escape, a lost pointer)
  cancel(): void;
}

export interface PointerTool {
  readonly id: string;
  // the press is this tool's (a session), or not (null: the pointer owner handles it as it would without the tool)
  press(at: ToolPoint, target: Element, state: EditorState, store: EditorStore): ToolSession | null;
  // the key context the canvas's keys are read in while the tool is on (its own Escape and Delete), or null; a tool
  // with no mode of its own has none
  keyContext?(ui: EditorUi): KeyContextId | null;
}

const tools: PointerTool[] = [];

// Installed once by each tool's owner when the editor starts; the function returned takes it away.
export function registerPointerTool(tool: PointerTool): () => void {
  if (tools.some((t) => t.id === tool.id)) throw new Error(`pointer tool ${tool.id} is installed twice`);
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
    const context = tool.keyContext?.(ui) ?? null;
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
  letters: [...letters],
});
