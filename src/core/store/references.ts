// What a command's argument names (its manifest `refers`: a collection, a variable, a guide…), and how each kind is
// found: the module that owns what a kind names registers how to find it, and the store refuses a name that names
// nothing before the handler runs (core/store/args.ts; the audit's AUD-09: 262 probes threw "the project has no
// collection …", 50 "no variable", 42 "no guide"). Every kind a built command's argument names has its finder, or the
// store does not start (createStore checks it, as it checks the predicates).
import type { DocumentJson } from '../document/model.ts';
import type { ModelRules } from '../document/validate.ts';
import type { REFERS } from '../../manifest/schema.ts';

export type ReferenceKind = (typeof REFERS)[number];
type Finder = (document: DocumentJson, value: string, rules: ModelRules) => boolean;

const finders = new Map<ReferenceKind, Finder>();

// the module that owns what a kind names says how to find one
export function registerReferenceKind(kind: ReferenceKind, finds: Finder): void {
  finders.set(kind, finds);
}

// whether a kind has its finder
export const referenceKindRegistered = (kind: ReferenceKind): boolean => finders.has(kind);

// whether the value names something of that kind the document or the editor holds
export function referenceFound(kind: ReferenceKind, document: DocumentJson, value: string, rules: ModelRules): boolean {
  const finds = finders.get(kind);
  if (finds === undefined) throw new Error(`no module registered how to find a ${kind}`);
  return finds(document, value, rules);
}
