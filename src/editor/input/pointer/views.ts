// What the pointer publishes (split out of src/editor/input/pointer.ts, which keeps the installer): the transient
// pointer state the canvas chrome, the rulers, the panels and the keymap read — the marquee's band, the hovered node,
// the drag in progress and the drop it proposes, the ghosts coming back, where the pointer is, whether Alt is held.
//
// None of it is editor state: it changes no command, it is not stored in the project and it is not undoable. Each is a
// value with a subscribe, so a React control redraws on it and nothing else. The installer is the only writer, through
// the setters here; a reader only gets and subscribes. Two editors would share it — which is why installing a second
// one is refused (pointer.ts).
import type { Message } from '../../../core/commands/registry.ts';
import type { NodeId } from '../../../core/document/model.ts';
import type { DoorEntry } from '../../../manifest/runtime.ts';
import type { Point } from '../../canvas/coordinates.ts';
import type { DropProposal, SideOffer } from '../../drag/drop.ts';

// The band of the marquee being drawn, in screen pixels, for the canvas chrome; null when no marquee is drawn.
// Pointer state, like the hovered node: the selection it makes goes through the store.
export interface Band {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
let drawnBand: Band | null = null;
const bandListeners = new Set<() => void>();
export const band = {
  get: (): Band | null => drawnBand,
  subscribe(listener: () => void): () => void {
    bandListeners.add(listener);
    return () => bandListeners.delete(listener);
  },
};
export function setBand(next: Band | null) {
  if (next === drawnBand) return;
  drawnBand = next;
  for (const listener of [...bandListeners]) listener();
}

// The node the pointer hovers on the canvas, for the canvas chrome: set by pointer moves over the page, null
// elsewhere. Pointer state, not editor state: it changes no command.
let hovered: string | null = null;
const hoverListeners = new Set<() => void>();
export const hover = {
  get: (): string | null => hovered,
  subscribe(listener: () => void): () => void {
    hoverListeners.add(listener);
    return () => hoverListeners.delete(listener);
  },
};
export function setHovered(node: string | null) {
  if (node === hovered) return;
  hovered = node;
  for (const listener of [...hoverListeners]) listener();
}

// The application menu button the pointer stands on (its data-menu), or null: while one application menu is open, the
// pointer moving onto another menu's button opens that one instead, as a desktop menu bar does (the dogfooding pass:
// each menu wanted its own click). Pointer state.
let menuUnder: string | null = null;
const menuListeners = new Set<() => void>();
export const menuOver = {
  get: (): string | null => menuUnder,
  subscribe(listener: () => void): () => void {
    menuListeners.add(listener);
    return () => menuListeners.delete(listener);
  },
};
export function setMenuOver(menu: string | null) {
  if (menu === menuUnder) return;
  menuUnder = menu;
  for (const listener of [...menuListeners]) listener();
}

// Whether Alt is held (spec hover-measure): while it is, the canvas draws the distances from the selection to the element
// under the pointer. The keymap, the owner of keys, says when it goes down and up (holdAlt); nothing changes in the
// document or the selection. Pointer state, for the canvas chrome.
let altDown = false;
const altListeners = new Set<() => void>();
export const measuring = {
  get: (): boolean => altDown,
  subscribe(listener: () => void): () => void {
    altListeners.add(listener);
    return () => altListeners.delete(listener);
  },
};
// whether Alt is held now, for the installer's own decisions (the leaves marquee, the duplicating drag)
export const altHeld = (): boolean => altDown;
export function holdAlt(down: boolean): void {
  if (down === altDown) return;
  altDown = down;
  for (const listener of [...altListeners]) listener();
}

// The node whose box a resize is dragging, and the handle it is pulled by, for the canvas chrome (item 4.5: the
// distances from the dragged edges to the neighbouring siblings are drawn while the drag goes on). Pointer state,
// not editor state: it changes no command.
let resizeNow: { readonly node: string; readonly handle: string } | null = null;
const resizeListeners = new Set<() => void>();
export const resizingNow = {
  get: (): { readonly node: string; readonly handle: string } | null => resizeNow,
  subscribe(listener: () => void): () => void {
    resizeListeners.add(listener);
    return () => resizeListeners.delete(listener);
  },
};
export function setResizing(next: { readonly node: string; readonly handle: string } | null) {
  if (next?.node === resizeNow?.node && next?.handle === resizeNow?.handle) return;
  resizeNow = next;
  for (const listener of [...resizeListeners]) listener();
}

// The edit handle (a spacing band, a gap, a radius, a shadow handle) a drag is pulling now, by its door: the chrome
// keeps it drawn, with its value, while the pointer has left it (the dogfooding pass: an unpinned band went faint the
// moment the pointer moved off it, and the value changing under the drag could not be read). Pointer state.
let bandNow: string | null = null;
const bandNowListeners = new Set<() => void>();
export const bandingNow = {
  get: (): string | null => bandNow,
  subscribe(listener: () => void): () => void {
    bandNowListeners.add(listener);
    return () => bandNowListeners.delete(listener);
  },
};
export function setBanding(next: string | null) {
  if (next === bandNow) return;
  bandNow = next;
  for (const listener of [...bandNowListeners]) listener();
}

// Where the pointer is while it is over the canvas's stage, for the rulers' marker (spec rulers); null elsewhere.
let pointerOnStage: Point | null = null;
const pointerListeners = new Set<() => void>();
export const canvasPointer = {
  get: (): Point | null => pointerOnStage,
  subscribe(listener: () => void): () => void {
    pointerListeners.add(listener);
    return () => pointerListeners.delete(listener);
  },
};
export function setCanvasPointer(at: Point | null) {
  if (at === pointerOnStage || (at !== null && pointerOnStage !== null && at.x === pointerOnStage.x && at.y === pointerOnStage.y)) return;
  pointerOnStage = at;
  for (const listener of [...pointerListeners]) listener();
}

// Where the last press went down on the screen, whatever it pressed (the canvas, a Layers row): the context menu opens
// there (spec context-menu: "a menu at the pointer"). Pointer state: it changes no command.
let lastPress: Point | null = null;
export const pressPoint = (): Point | null => lastPress;
export function setPressPoint(at: Point | null): void {
  lastPress = at;
}

// Where the last press went down, by the keys it gives the canvas (jornada03 J2): on the canvas (the stage or the page
// in its frame), on the Layers tree, or elsewhere (a panel, a picker, a menu). The keymap runs the canvas's
// single-letter shortcuts only while the person chose the canvas or the Layers (keymap.ts lettersChosen); a count
// tells the keymap a press happened since it last read. Pointer state: it changes no command.
export type PressRegion = 'canvas' | 'layers' | 'elsewhere';
let lastRegion: PressRegion = 'elsewhere';
let choiceOrder = 0;
let presses = 0;
export const pressRegion = (): PressRegion => lastRegion;
export const pressCount = (): number => presses;
export function setPressRegion(region: PressRegion): void {
  lastRegion = region;
  presses = ++choiceOrder;
}

// The keyboard chose the canvas (F6 onto it, focus.ts): counted like a press, for the keymap
let keyboardChoices = 0;
export const canvasChosenCount = (): number => keyboardChoices;
export function chooseCanvasByKeyboard(): void {
  keyboardChoices = ++choiceOrder;
}

// Whether a pointer button is down anywhere in the editor: the keymap asks it to tell a focus a click gave from one
// the keyboard gave (Space on a focused control, keymap.ts)
let pressing = false;
export const pointerPressing = (): boolean => pressing;
export function setPressing(down: boolean): void {
  pressing = down;
}

// the ruler a guide being dragged is over, its own (the chrome's delete hint), or null
let guideOnRuler: string | null = null;
const guideRulerListeners = new Set<() => void>();
export const guideOverRuler = {
  get: (): string | null => guideOnRuler,
  subscribe(listener: () => void): () => void {
    guideRulerListeners.add(listener);
    return () => guideRulerListeners.delete(listener);
  },
};
export function setGuideOnRuler(axis: string | null): void {
  if (axis === guideOnRuler) return;
  guideOnRuler = axis;
  for (const listener of [...guideRulerListeners]) listener();
}

// Whether the stage is being panned (spec canvas-pan): idle, armed by space over the stage, or panning.
export type PanView = 'idle' | 'armed' | 'panning';
let panView: PanView = 'idle';
const panListeners = new Set<() => void>();
export function setPanView(view: PanView): void {
  if (view === panView) return;
  panView = view;
  for (const listener of panListeners) listener();
}
export const panState = {
  get: (): PanView => panView,
  subscribe: (listener: () => void): (() => void) => {
    panListeners.add(listener);
    return () => panListeners.delete(listener);
  },
};

// A creation drag from a palette tile: the tile's door, its arguments and the drop door it will run.
export interface Inserting {
  readonly tile: DoorEntry;
  readonly args: Readonly<Record<string, unknown>>;
  readonly drop: DoorEntry;
}

// A refusal the drop met where the pointer is, and the element that refused: the proposal drawn is then the nearest
// place that takes it (spec drag-layout, Problems in Pager 4).
export interface Redirect {
  readonly why: Message;
  readonly from: NodeId;
}
export interface DragView {
  readonly dragged: readonly NodeId[];
  readonly inserting: Inserting | null;
  readonly proposal: DropProposal | null;
  readonly refusal: Message | null;
  readonly redirect: Redirect | null;
  readonly levels: number;
  readonly at: Point;
  // the side drop offered where the pointer is (spec drag-layout, row 5): confirmed once the pointer stayed
  // wrap.sideDwell in its band (then its pill is drawn where it was confirmed, and a release wraps), else only offered
  // (a release is the ordinary drop the proposal draws); with the refusal its wrap would meet
  readonly side: SideView | null;
}
export interface SideView {
  readonly offer: SideOffer;
  readonly armed: boolean;
  readonly pill: Point | null;
  readonly refusal: Message | null;
}
let dragView: DragView | null = null;
const dragListeners = new Set<() => void>();
export const drag = {
  get: (): DragView | null => dragView,
  subscribe(listener: () => void): () => void {
    dragListeners.add(listener);
    return () => dragListeners.delete(listener);
  },
};
export function setDrag(next: DragView | null) {
  if (next === dragView) return;
  dragView = next;
  for (const listener of [...dragListeners]) listener();
}

// The elements a drop has just placed, for the canvas chrome, which flashes them (spec drag-layout, row 10); numbered,
// so the same elements dropped again flash again.
export interface Dropped {
  readonly id: number;
  readonly nodes: readonly NodeId[];
}
let dropped: Dropped | null = null;
let drops = 0;
const droppedListeners = new Set<() => void>();
export const lastDrop = {
  get: (): Dropped | null => dropped,
  subscribe(listener: () => void): () => void {
    droppedListeners.add(listener);
    return () => droppedListeners.delete(listener);
  },
};
export function setDropped(nodes: readonly NodeId[]) {
  drops += 1;
  dropped = { id: drops, nodes };
  for (const listener of [...droppedListeners]) listener();
}

// The ghost of a creation drag Escape cancelled, for the canvas chrome, which plays its way back (spec
// drag-level-keys-escape, Problems in Pager 4): the palette entry, where the pointer was and where the press went down
// on the tile, on the screen; each one numbered, so a new one plays anew. Pointer state: the next press takes it away.
export interface GhostReturn {
  readonly id: number;
  readonly inserting: Inserting;
  readonly from: Point;
  readonly to: Point;
}
let returningGhost: GhostReturn | null = null;
let ghostReturns = 0;
const returnListeners = new Set<() => void>();
export const ghostReturn = {
  get: (): GhostReturn | null => returningGhost,
  subscribe(listener: () => void): () => void {
    returnListeners.add(listener);
    return () => returnListeners.delete(listener);
  },
};
export function setGhostReturn(next: Omit<GhostReturn, 'id'> | null) {
  if (next === null && returningGhost === null) return;
  if (next !== null) ghostReturns += 1;
  returningGhost = next === null ? null : { id: ghostReturns, ...next };
  for (const listener of [...returnListeners]) listener();
}
