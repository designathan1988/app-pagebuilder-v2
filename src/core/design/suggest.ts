// Styles the site repeats, offered as one class (the plan's stage 7, "sugestões de repetição"; journey M3: the same
// padding typed on every section, 24 edits where 6 would do). The one owner of:
//  - suggestionsOf: for each element type with at least two elements on the project's pages, the declarations of the
//    base breakpoint and state that every one of them holds with the same value (its own styles, not a class's) — a
//    suggestion when there is any, the most elements first;
//  - design.applySuggestion: a new class holds those declarations, every element of the type lists it and keeps none
//    of them of its own; one undo step.
import { message, registerHandler, type Outcome } from '../commands/registry.ts';
import { locate, walk, type DocNode, type DocumentJson, type NodeId, type StoredValue, type StyleClass } from '../document/model.ts';
import type { Patch } from '../history/transaction.ts';
import { firstLockRefusal } from '../nodes/flags.ts';
import { isIdentifier } from '../text/identifier.ts';
import { classesOf } from './classes.ts';

// the breakpoint and the state a suggestion reads (the base ones: what an element looks like everywhere)
const [BASE_BREAKPOINT = '', BASE_STATE = ''] = 'desktop base'.split(' ');

export interface Suggestion {
  readonly type: string;
  readonly nodes: readonly NodeId[];
  readonly declarations: Readonly<Record<string, StoredValue>>;
}

const baseOf = (node: DocNode): Readonly<Record<string, StoredValue>> => ((node.styles as Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>)[BASE_BREAKPOINT]?.[BASE_STATE] ?? {}) as Readonly<Record<string, StoredValue>>;
const same = (a: StoredValue, b: StoredValue) => JSON.stringify(a) === JSON.stringify(b);

// the elements of every page, by type (the page roots aside)
function byType(document: DocumentJson): Map<string, DocNode[]> {
  const found = new Map<string, DocNode[]>();
  for (const page of document.pages) {
    for (const node of walk(page.tree)) {
      if (node === page.tree) continue;
      found.set(node.type, [...(found.get(node.type) ?? []), node]);
    }
  }
  return found;
}

export function suggestionsOf(document: DocumentJson): readonly Suggestion[] {
  const out: Suggestion[] = [];
  for (const [type, nodes] of byType(document)) {
    if (nodes.length < 2) continue;
    const [first, ...rest] = nodes as [DocNode, ...DocNode[]];
    const shared = Object.entries(baseOf(first)).filter(([property, value]) => rest.every((node) => {
      const held = baseOf(node)[property];
      return held !== undefined && same(held, value);
    }));
    if (shared.length > 0) out.push({ type, nodes: nodes.map((node) => node.id as NodeId), declarations: Object.fromEntries(shared) });
  }
  return out.sort((a, b) => b.nodes.length - a.nodes.length);
}

// the first free class name made of a type's: section, section-2…
export function suggestedName(document: DocumentJson, type: string): string {
  const taken = new Set(classesOf(document).map((one) => one.name));
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? type : `${type}-${n}`;
    if (!taken.has(name)) return name;
  }
}

export const applySuggestionCommand = registerHandler('design.applySuggestion', (context, { type, name }): Outcome<never> => {
  const { state } = context;
  const suggestion = suggestionsOf(state.document).find((one) => one.type === type);
  if (suggestion === undefined) return { kind: 'refused', message: message('status.suggest.none', { type }) };
  const typed = name.trim();
  if (!isIdentifier(typed)) return { kind: 'refused', message: message('status.classes.badName', { name: typed }) };
  if (classesOf(state.document).some((one) => one.name === typed)) return { kind: 'refused', message: message('status.classes.nameTaken', { name: typed }) };
  const locked = firstLockRefusal(state.document, suggestion.nodes, 'status.locked.edit');
  if (locked !== null) return { kind: 'refused', message: locked };
  const styleClass: StyleClass = { name: typed, styles: { [BASE_BREAKPOINT]: { [BASE_STATE]: suggestion.declarations } } as StyleClass['styles'] };
  const patches: Patch[] = [state.document.classes === undefined ? { op: 'add', path: ['classes'], value: [styleClass] } : { op: 'add', path: ['classes', classesOf(state.document).length], value: styleClass }];
  for (const id of suggestion.nodes) {
    const at = locate(state.document, id);
    if (at === null) continue;
    const kept = Object.fromEntries(Object.entries(baseOf(at.node)).filter(([property]) => !(property in suggestion.declarations)));
    // the element's styles without the shared declarations; a state, then a breakpoint, left empty goes too
    const styles = Object.fromEntries(
      Object.entries(at.node.styles as Readonly<Record<string, Readonly<Record<string, unknown>>>>)
        .map(([breakpoint, states]) => [
          breakpoint,
          Object.fromEntries(Object.entries(states).flatMap(([state, held]) => (breakpoint === BASE_BREAKPOINT && state === BASE_STATE ? (Object.keys(kept).length > 0 ? [[state, kept]] : []) : [[state, held]])))
        ] as const)
        .filter(([, states]) => Object.keys(states).length > 0),
    );
    patches.push({ op: 'replace', path: [...at.path, 'styles'], value: styles });
    if (!at.node.classes.includes(typed)) patches.push({ op: 'replace', path: [...at.path, 'classes'], value: [...at.node.classes, typed] });
  }
  return { kind: 'change', patches, message: message('status.suggest.applied', { name: typed, count: suggestion.nodes.length }) };
});
