// The constraint solver (spec "Constraints"): same width or height, equal gaps, a kept ratio, alignment, and sizing
// rules (fixed, minimum and maximum, fill the remaining space, fluid, hug). The drawn geometry is the starting guess;
// each constraint is a projection that moves the regions it names as little as it can to hold, applied in a fixed order
// until nothing moves (Gauss-Seidel style, deterministic: the same graph always solves to the same graph). A constraint
// that still moves something once the passes settle contradicts another: it is returned as a conflict, never dropped.
import type { Axis, Box, Constraint, Dimension, LayoutIntent, LayoutValue, Region } from '../intent/model.ts';
import { findRegion } from '../intent/model.ts';
import { refuse } from '../intent/problems.ts';
import { bounds, cross, end, length, precision } from '../geometry/geometry.ts';
import { lengthKey } from '../geometry/keys.ts';

export interface Solution {
  readonly graph: LayoutIntent;
  // the ids of the constraints the others keep from holding
  readonly conflicts: readonly string[];
}

const PASSES = 64;

// A length a constraint names: a number of px, or the value of a layout variable.
export function resolveValue(graph: LayoutIntent, value: LayoutValue): number {
  const resolved = typeof value === 'number' ? value : graph.variables[value];
  if (resolved === undefined || !Number.isFinite(resolved)) refuse('unknown-variable', { name: String(value) });
  return resolved;
}

const moved = (a: Box, b: Box): boolean => Math.abs(a.x - b.x) > precision || Math.abs(a.y - b.y) > precision || Math.abs(a.width - b.width) > precision || Math.abs(a.height - b.height) > precision;

const withLength = (box: Box, axis: Axis, value: number): Box => ({ ...box, [lengthKey(axis)]: value });
const withStart = (box: Box, axis: Axis, value: number): Box => ({ ...box, [axis]: value });

// what a region's own sizing allows along an axis
function clampToDimension(value: number, dimension: Dimension): number {
  return Math.max(dimension.min ?? precision * 2, Math.min(dimension.max ?? Infinity, value));
}

function parentBox(graph: LayoutIntent, r: Region): Box {
  return r.parent === null ? graph.viewport : (findRegion(graph, r.parent)?.box ?? graph.viewport);
}

// Two boxes in the same band along an axis: they overlap across it, so one stands before the other along it.
function inBand(a: Box, b: Box, axis: Axis): boolean {
  const across = cross(axis);
  return Math.min(end(a, across), end(b, across)) - Math.max(a[across], b[across]) > precision;
}

// Regions laid one after the other along an axis, in one band: a row (x) or a column (y).
function inOneLine(held: readonly Region[], axis: Axis): boolean {
  return held.every((r, i) => i === 0 || inBand((held[0] as Region).box, r.box, axis));
}

// The regions' new lengths, re-packed from the first one's start with the gaps they had, so a row stays a row.
function repack(held: readonly Region[], axis: Axis, lengths: ReadonlyMap<string, number>): Map<string, Box> {
  const sorted = [...held].sort((a, b) => a.box[axis] - b.box[axis] || a.id.localeCompare(b.id));
  const result = new Map<string, Box>();
  const line = inOneLine(sorted, axis);
  let at = (sorted[0] as Region).box[axis];
  sorted.forEach((r, i) => {
    const size = lengths.get(r.id) ?? length(r.box, axis);
    if (!line) {
      result.set(r.id, withLength(r.box, axis, size));
      return;
    }
    if (i > 0) {
      const previous = sorted[i - 1] as Region;
      at += Math.max(0, r.box[axis] - end(previous.box, axis));
    }
    result.set(r.id, withLength(withStart(r.box, axis, at), axis, size));
    at += size;
  });
  return result;
}

// The free room after a region along an axis: up to the next sibling in its band, or its parent's end.
function roomAfter(graph: LayoutIntent, r: Region, axis: Axis): number {
  const limit = graph.regions.filter((s) => s.parent === r.parent && s.id !== r.id && s.box[axis] >= end(r.box, axis) - precision && inBand(s.box, r.box, axis)).reduce((m, s) => Math.min(m, s.box[axis]), end(parentBox(graph, r), axis));
  return limit - r.box[axis];
}

// The free room before a region along an axis: back to the previous sibling in its band, or its parent's start.
function startLimit(graph: LayoutIntent, r: Region, axis: Axis): number {
  return graph.regions.filter((s) => s.parent === r.parent && s.id !== r.id && end(s.box, axis) <= r.box[axis] + precision && inBand(s.box, r.box, axis)).reduce((m, s) => Math.max(m, end(s.box, axis)), parentBox(graph, r)[axis]);
}

function project(graph: LayoutIntent, constraint: Constraint): LayoutIntent {
  const held = constraint.regions.map((id) => findRegion(graph, id)).filter((r): r is Region => r !== undefined);
  if (held.length === 0) return graph;
  const updates = new Map<string, Region>();
  const setBox = (r: Region, box: Box) => updates.set(r.id, { ...(updates.get(r.id) ?? r), box });
  if (constraint.kind === 'equal-size') {
    const axis = constraint.axis;
    const key = lengthKey(axis);
    // a region fixed along the axis gives the size the others take; two fixed at different sizes cannot both hold
    const fixed = held.filter((r) => r[key].mode === 'fixed').map((r) => length(r.box, axis));
    const target = fixed.length > 0 ? (fixed[0] as number) : held.reduce((s, r) => s + length(r.box, axis), 0) / held.length;
    const lengths = new Map(held.map((r) => [r.id, clampToDimension(target, r[key])]));
    for (const [id, box] of repack(held, axis, lengths)) setBox(held.find((r) => r.id === id) as Region, box);
  } else if (constraint.kind === 'gap') {
    const axis = constraint.axis;
    const gap = resolveValue(graph, constraint.value);
    const sorted = [...held].sort((a, b) => a.box[axis] - b.box[axis] || a.id.localeCompare(b.id));
    let at = (sorted[0] as Region).box[axis];
    for (const r of sorted) {
      setBox(r, withStart(r.box, axis, at));
      at += length(r.box, axis) + gap;
    }
  } else if (constraint.kind === 'ratio') {
    for (const r of held) {
      // the height follows the width, unless the height is the fixed one
      if (r.height.mode === 'fixed' && r.width.mode !== 'fixed') setBox(r, withLength(r.box, 'x', clampToDimension(r.box.height * constraint.value, r.width)));
      else setBox(r, withLength(r.box, 'y', clampToDimension(r.box.width / constraint.value, r.height)));
    }
  } else if (constraint.kind === 'align') {
    const axis = constraint.axis;
    const group = bounds(held.map((r) => r.box));
    for (const r of held) {
      const at = constraint.edge === 'start' ? group[axis] : constraint.edge === 'end' ? end(group, axis) - length(r.box, axis) : group[axis] + (length(group, axis) - length(r.box, axis)) / 2;
      setBox(r, withStart(r.box, axis, at));
    }
  } else {
    const axis = constraint.axis;
    const key = lengthKey(axis);
    for (const r of held) {
      const dimension = constraint.dimension;
      let box = r.box;
      if (dimension.mode === 'fill-available') {
        // fill what is left: forward to the next obstacle and, when nothing stands before it, back to the parent's
        // start
        const start = startLimit(graph, r, axis);
        const first = !graph.regions.some((s) => s.parent === r.parent && s.id !== r.id && end(s.box, axis) <= r.box[axis] + precision && inBand(s.box, r.box, axis));
        const from = first ? start : r.box[axis];
        box = withStart(box, axis, from);
        box = withLength(box, axis, roomAfter(graph, { ...r, box }, axis));
      } else if (dimension.mode === 'fixed' && constraint.value !== undefined) box = withLength(box, axis, resolveValue(graph, constraint.value));
      box = withLength(box, axis, clampToDimension(length(box, axis), dimension));
      updates.set(r.id, { ...(updates.get(r.id) ?? r), [key]: dimension, box });
    }
  }
  return updates.size === 0 ? graph : { ...graph, regions: graph.regions.map((r) => updates.get(r.id) ?? r) };
}

// Each region's own minimum and maximum hold on its drawn box too: setting a minimum width larger than the drawing
// widens the drawing.
function clampRegions(graph: LayoutIntent): LayoutIntent {
  let changed = false;
  const regions = graph.regions.map((r) => {
    const width = clampToDimension(r.box.width, r.width);
    const height = clampToDimension(r.box.height, r.height);
    if (Math.abs(width - r.box.width) <= precision && Math.abs(height - r.box.height) <= precision) return r;
    changed = true;
    return { ...r, box: { ...r.box, width, height } };
  });
  return changed ? { ...graph, regions } : graph;
}

export function solve(graph: LayoutIntent): Solution {
  let next = clampRegions(graph);
  for (let pass = 0; pass < PASSES; pass += 1) {
    const before = next;
    for (const c of graph.constraints) next = project(next, c);
    next = clampRegions(next);
    if (next.regions.every((r, i) => !moved(r.box, (before.regions[i] as Region).box))) break;
  }
  const settled = next;
  const conflicts = graph.constraints.filter((c) => project(settled, c).regions.some((r, i) => moved(r.box, (settled.regions[i] as Region).box))).map((c) => c.id);
  return { graph: next, conflicts };
}
