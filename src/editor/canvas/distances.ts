// Distances on the canvas, in the chrome's screen px, each with its length in CSS px (screen px divided by the zoom):
// what the Alt measurement (spec hover-measure, hover-measure.ts) and a resize in flow (item 4.5, chrome.tsx) draw.
import type { Box } from './placement.ts';

export interface Distance {
  readonly box: Box;
  readonly value: number;
}

// The distances Alt measures (spec hover-measure, Problems in Pager 2), in the chrome's screen px, each with its length
// in CSS px (screen px divided by the zoom): over an ancestor of the selection, from the selection to the ancestor's
// inner edges (its padding box); over any other element, between the nearest edges of the two on each axis where they
// do not overlap, at the middle of what they share on the other axis, else of the selection.
export function distancesOf(selected: Box, other: Box, inner: Box | null, zoom: number): Distance[] {
  const css = (px: number) => Math.round(px / zoom);
  const midX = selected.x + selected.width / 2;
  const midY = selected.y + selected.height / 2;
  if (inner !== null) {
    const right = selected.x + selected.width;
    const bottom = selected.y + selected.height;
    return [
      { box: { x: midX, y: inner.y, width: 0, height: selected.y - inner.y }, value: css(selected.y - inner.y) },
      { box: { x: midX, y: bottom, width: 0, height: inner.y + inner.height - bottom }, value: css(inner.y + inner.height - bottom) },
      { box: { x: inner.x, y: midY, width: selected.x - inner.x, height: 0 }, value: css(selected.x - inner.x) },
      { box: { x: right, y: midY, width: inner.x + inner.width - right, height: 0 }, value: css(inner.x + inner.width - right) },
    ].filter((d) => d.value > 0);
  }
  const shared = (a0: number, a1: number, b0: number, b1: number, fallback: number) => (Math.max(a0, b0) < Math.min(a1, b1) ? (Math.max(a0, b0) + Math.min(a1, b1)) / 2 : fallback);
  const out: Distance[] = [];
  const y = shared(selected.y, selected.y + selected.height, other.y, other.y + other.height, midY);
  if (other.x >= selected.x + selected.width) out.push({ box: { x: selected.x + selected.width, y, width: other.x - selected.x - selected.width, height: 0 }, value: css(other.x - selected.x - selected.width) });
  else if (other.x + other.width <= selected.x) out.push({ box: { x: other.x + other.width, y, width: selected.x - other.x - other.width, height: 0 }, value: css(selected.x - other.x - other.width) });
  const x = shared(selected.x, selected.x + selected.width, other.x, other.x + other.width, midX);
  if (other.y >= selected.y + selected.height) out.push({ box: { x, y: selected.y + selected.height, width: 0, height: other.y - selected.y - selected.height }, value: css(other.y - selected.y - selected.height) });
  else if (other.y + other.height <= selected.y) out.push({ box: { x, y: other.y + other.height, width: 0, height: selected.y - other.y - other.height }, value: css(selected.y - other.y - other.height) });
  return out;
}
