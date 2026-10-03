// The quick panel (INVENTORY.md, owners; spec quick-panel; archive/DESIGN.md "Canvas", Quick panel): a small panel
// near the primary selected element, collapsed to a chip by default, whose fields are the doors the manifest places in
// the quick-panel region (each runs the same command as the matching inspector field; canvas/quick-panel.tsx draws
// them).
//
// quickPanel.setOpen opens, closes or turns the panel over: the chip's press, the shortcut that reaches it from
// anywhere, and Escape while the focus is in the panel (its key context absorbs the fields inside it: keymap.ts).
// It is window chrome: nothing in the document changes and nothing is recorded in the history.
//
// quickPanel.setOffset remembers where the person dragged the panel by its grip, for that element: the offset of the
// panel's top-left corner from the element's, in screen pixels, kept in the preferences (spec, Problems in Pager 1),
// so it survives a reload. It is window chrome: nothing in the document changes and nothing is recorded in the
// history. Its distance, the pointer's horizontal travel, is already in the offset the drag gives.
//
// Where the chip goes (placeChip): beside the selection's label, on its right (on its left when the stage has no room
// there), level with it (archive/DESIGN.md "Canvas": the label, its size chip and the quick panel chip beside it), so
// it covers no more of the page than the label does. Where the open panel goes (placeQuickPanel): a remembered offset,
// held inside the stage, whichever part of the element it covers — the person dragged it there; otherwise the side of
// the element with the most free space where the panel fits (above, below, right, left, in that order on a tie), clear
// of the element's label above it; with no side free, the side where, held inside the stage, it covers the least of the
// element. The stage keeps an inset free all round.
//
// Which fields it shows (appliesTo): a field shows only when its property applies to the selected element, by the
// element predicates of core/style/applies.ts: the text properties on an element that holds text, the SVG fill on an
// SVG shape, the box properties on an HTML element, a kind's properties on an element of that kind; a property that
// applies always, or by a rule that reads more than the element (a container's, a flex item's), shows.
import { registerHandler } from '../../core/commands/registry.ts';
import type { DocNode } from '../../core/document/model.ts';
import type { ModelRules } from '../../core/document/validate.ts';
import { appliesToOf, elementPredicate } from '../../core/style/applies.ts';
import type { EditorUi } from '../state.ts';

export interface Offset {
  readonly x: number;
  readonly y: number;
}
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const NO_OFFSETS: Readonly<Record<string, Offset>> = {};

// the offsets remembered, per element
export const quickPanelOffsets = (ui: EditorUi): Readonly<Record<string, Offset>> => ui.preferences.quickPanelOffsets ?? NO_OFFSETS;

// whether the panel is open (its chip, the shortcut, Escape in the panel)
export const quickPanelOpen = (ui: EditorUi): boolean => ui.quickPanelOpen === true;

export const setOpen = registerHandler<'quickPanel.setOpen', EditorUi>('quickPanel.setOpen', ({ state }, { open }) => {
  const now = quickPanelOpen(state.ui);
  const next = open === 'toggle' ? !now : open === 'open';
  if (next === now) return { kind: 'change' };
  return { kind: 'change', ui: { ...state.ui, quickPanelOpen: next ? true : undefined } };
});

export const setOffset = registerHandler<'quickPanel.setOffset', EditorUi>('quickPanel.setOffset', ({ state }, { target, offset }) => {
  const x = Math.round(offset.x);
  const y = Math.round(offset.y);
  const held = quickPanelOffsets(state.ui)[target];
  if (held !== undefined && held.x === x && held.y === y) return { kind: 'change' };
  return { kind: 'change', ui: { ...state.ui, preferences: { ...state.ui.preferences, quickPanelOffsets: { ...quickPanelOffsets(state.ui), [target]: { x, y } } } } };
});

// A stored offset list: each entry a node id with whole x and y; anything else is left out (preferences.ts).
export function readOffsets(stored: unknown): Readonly<Record<string, Offset>> | undefined {
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return undefined;
  const kept = Object.entries(stored as Record<string, unknown>).flatMap(([id, value]): [string, Offset][] => {
    if (value === null || typeof value !== 'object') return [];
    const { x, y } = value as Record<string, unknown>;
    return typeof x === 'number' && typeof y === 'number' && Number.isInteger(x) && Number.isInteger(y) ? [[id, { x, y }]] : [];
  });
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

// Where the panel (or its chip) of `size` goes for an element's box, all in the stage's pixels: `above` is the room the
// element's label takes above it, `gap` the space between the panel and what it is placed beside, `inset` the margin
// kept free inside the stage.
export function placeQuickPanel(element: Box, size: { readonly width: number; readonly height: number }, stage: Box, spacing: { readonly gap: number; readonly inset: number; readonly above: number }, offset: Offset | null): Box {
  const { gap, inset, above } = spacing;
  const inner = { x: stage.x + inset, y: stage.y + inset, width: Math.max(0, stage.width - 2 * inset), height: Math.max(0, stage.height - 2 * inset) };
  const right = inner.x + inner.width;
  const bottom = inner.y + inner.height;
  const heldX = (x: number) => clamp(x, inner.x, right - size.width);
  const heldY = (y: number) => clamp(y, inner.y, bottom - size.height);
  if (offset !== null) {
    // The person's own drag wins: the panel is where it was left, held inside the stage. A remembered offset is never
    // refused for covering the element — the panel is taller than most elements, and refusing the drag would leave a
    // panel that jumps back under the pointer (spec quick-panel, scenario the-grip-drags-the-panel-…).
    return { x: heldX(element.x + offset.x), y: heldY(element.y + offset.y), ...size };
  }
  const centreX = heldX(element.x + element.width / 2 - size.width / 2);
  const centreY = heldY(element.y);
  const sides = [
    { box: { x: centreX, y: element.y - above - gap - size.height, ...size }, free: element.y - above - inner.y },
    { box: { x: centreX, y: element.y + element.height + gap, ...size }, free: bottom - (element.y + element.height) },
    { box: { x: element.x + element.width + gap, y: centreY, ...size }, free: right - (element.x + element.width) },
    { box: { x: element.x - gap - size.width, y: centreY, ...size }, free: element.x - inner.x },
  ];
  const fits = (b: Box) => b.x >= inner.x && b.y >= inner.y && b.x + b.width <= right && b.y + b.height <= bottom;
  const best = sides.filter((s) => fits(s.box)).reduce<(typeof sides)[number] | null>((most, s) => (most === null || s.free > most.free ? s : most), null);
  if (best !== null) return best.box;
  // No side holds it whole: each side's place, held inside the stage, and the one that covers the least of the element
  // wins (on a tie the first of above, below, right, left: centred over the element, its side edges and their handles
  // stay free) — the panel pinned at the stage's top covered a text near the top whole, and the
  // handles Edit on canvas draws on it with it (spec quick-panel, Problems in Pager 9)
  const held = sides.map((s) => ({ ...s, box: { ...s.box, x: heldX(s.box.x), y: heldY(s.box.y) } }));
  const covered = (b: Box) => Math.max(0, Math.min(b.x + b.width, element.x + element.width) - Math.max(b.x, element.x)) * Math.max(0, Math.min(b.y + b.height, element.y + element.height) - Math.max(b.y, element.y));
  const least = held.reduce((most, s) => (covered(s.box) < covered(most.box) ? s : most));
  return least.box;
}

export function placeChip(label: Box, size: { readonly width: number; readonly height: number }, stage: Box, gap: number): Box {
  const right = label.x + label.width + gap;
  const beside = right + size.width <= stage.x + stage.width ? right : label.x - gap - size.width;
  // held inside the stage (a label of an element the view shows in part lies partly outside it)
  const x = clamp(beside, stage.x, stage.x + stage.width - size.width);
  const y = clamp(label.y + (label.height - size.height) / 2, stage.y, stage.y + stage.height - size.height);
  return { x, y, ...size };
}

// the offset of a placed panel from its element, what quickPanel.setOffset keeps
export const offsetOf = (panel: Box, element: Box): Offset => ({ x: Math.round(panel.x - element.x), y: Math.round(panel.y - element.y) });

// ------------------------------------------------------------------ which fields apply

// whether a field writing these properties shows for this node: every property it writes applies to it
export function appliesTo(properties: readonly string[], node: DocNode, rules: ModelRules): boolean {
  return properties.every((property) => {
    const predicate = appliesToOf(property, rules);
    return predicate === null || elementPredicate(predicate, node, rules) !== false;
  });
}
