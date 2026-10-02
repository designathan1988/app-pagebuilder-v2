// The identities the graph hands out. They come from the graph itself (its regions and its revision), never from a
// clock or a random source, so the same gestures on the same graph always produce the same ids: undo and redo, a
// scenario replayed by the browser runner and the same steps dispatched in a test all meet the same graph.
import type { LayoutIntent } from './model.ts';

const REGION = /^r(\d+)$/;
const CONSTRAINT = /^c(\d+)$/;
const RULE = /^w(\d+)$/;
const MORPH = /^m(\d+)$/;

function nextNumber(ids: Iterable<string>, pattern: RegExp): number {
  let max = 0;
  for (const id of ids) {
    const found = pattern.exec(id);
    if (found !== null) max = Math.max(max, Number(found[1]));
  }
  return max + 1;
}

export const nextRegionId = (graph: LayoutIntent): string => `r${nextNumber(graph.regions.map((r) => r.id), REGION)}`;
export const nextConstraintId = (graph: LayoutIntent): string => `c${nextNumber(graph.constraints.map((c) => c.id), CONSTRAINT)}`;
export const nextRuleId = (graph: LayoutIntent): string => `w${nextNumber(graph.responsive.map((r) => r.id), RULE)}`;
export const nextMorphId = (graph: LayoutIntent): string => `m${nextNumber((graph.morphs ?? []).map((m) => m.id), MORPH)}`;

// The id of the operation the graph's next revision records in the provenance of what it touches.
export const operationId = (graph: LayoutIntent): string => `op${graph.revision + 1}`;
