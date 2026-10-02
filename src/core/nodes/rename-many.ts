// Renaming the selected elements at once (spec batch-rename; the plan's stage 5, "renomear em lote"): a pattern where
// {name} is each element's name and {n} its number, counting from `start` in the order of the selection ("Card {n}"
// names three cards Card 1, Card 2, Card 3). Every name goes through the one renamer (element.rename, core/nodes/
// names.ts), so a locked element or the page root refuses the whole batch and nothing is renamed; one undo step.
import { message, registerHandler } from '../commands/registry.ts';
import type { HandlerContext } from '../commands/registry.ts';
import { renameBatch } from '../export/authoring.ts';
import type { NodeId } from '../document/model.ts';

export const renameManyCommand = registerHandler('element.renameMany', (context, { pattern, start }) => {
  const targets = context.state.selection as readonly NodeId[];
  if (targets.length === 0) return { kind: 'change' };
  const typed = pattern.trim();
  const first = Number(start);
  if (typed === '' || !Number.isSafeInteger(first) || first < 1) return { kind: 'refused', message: message('status.rename.patternInvalid') };
  // a pattern that names nobody (an empty result) is refused before any change
  const outcome = renameBatch(context as unknown as HandlerContext<never>, targets, typed, first);
  if (outcome.kind !== 'change') return outcome;
  return { ...outcome, message: message('status.rename.many', { count: targets.length }) };
});
