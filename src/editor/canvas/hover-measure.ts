// The hover measure (spec hover-measure): the hovered element's size, in CSS px, in a chip under its hover outline,
// and, while Alt is held with one element selected, the distances from the selection to the hovered element (to an
// ancestor's inner edges, else between the nearest edges; distances.ts). Measuring never changes the selection or the
// document. The canvas chrome draws what these return (chrome.tsx), and nothing when they return nothing: this module is
// the feature's code, the one the tooth proof switches off (manifest toothProof).
import { distancesOf, type Distance } from './distances.ts';
import type { Box } from './placement.ts';

// the size chip: where it goes in the chrome layer, the size it says, and whether it stands at the outline's end
export interface HoverSize {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly end: boolean;
}

// The hovered element's size chip: under the outline's bottom-left corner (its box on the screen), or under its
// bottom-right one where it would meet the selection's label (`end`; jornada03 J16), saying its size as the page lays
// it out, in CSS px rounded to whole ones, at any zoom (`size`: coordinates.ts nodeSize).
export function hoverSizeOf(hovered: Box | null, size: { readonly width: number; readonly height: number } | null, end: boolean): HoverSize | null {
  if (hovered === null || size === null) return null;
  return { x: end ? hovered.x + hovered.width : hovered.x, y: hovered.y + hovered.height, width: Math.round(size.width), height: Math.round(size.height), end };
}

// The distances Alt measures: from the one selected element to the hovered one, or to the inner edges (`inner`) of the
// hovered ancestor; none without Alt, a single selection or a hovered element.
export function altDistances(alt: boolean, selected: Box | undefined, hovered: Box | null, inner: Box | null, zoom: number): readonly Distance[] {
  if (!alt || selected === undefined || hovered === null) return [];
  return distancesOf(selected, hovered, inner, zoom);
}
