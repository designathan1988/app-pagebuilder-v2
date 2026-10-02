// The patches that turn one document into another, as small as the change allows. The content operations compute the
// document they lead to (a list refilled, a region copied to every page, an item written back) with the same pure
// functions the derivation uses, then hand the store the difference as patches: the store's one applier applies them,
// the history keeps their inverses, and the canvas redraws only the nodes that changed.
import type { DocNode, DocumentJson } from '../document/model.ts';
import { deepEqual, type Patch, type Path } from '../history/transaction.ts';

// The keys of a node besides its children, which a patch sets one by one.
const keysOf = (a: object, b: object): string[] => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => key !== 'children');

// The patches from one value of an object key to another (absent on either side included).
function keyPatches(path: Path, before: Readonly<Record<string, unknown>>, after: Readonly<Record<string, unknown>>, key: string): Patch[] {
  const had = Object.hasOwn(before, key);
  const has = Object.hasOwn(after, key);
  if (!had && !has) return [];
  if (had && !has) return [{ op: 'remove', path: [...path, key] }];
  if (!had) return [{ op: 'add', path: [...path, key], value: after[key] }];
  return deepEqual(before[key], after[key]) ? [] : [{ op: 'replace', path: [...path, key], value: after[key] }];
}

// From one node to another at a path: the node replaced whole when it is another node (another id); else its own keys
// one by one, and its children each in turn while they are the same nodes in the same order, or the children list
// replaced whole when one came, went or moved.
export function treePatches(path: Path, before: DocNode, after: DocNode): Patch[] {
  if (before === after || deepEqual(before, after)) return [];
  if (before.id !== after.id) return [{ op: 'replace', path, value: after }];
  const own = keysOf(before, after).flatMap((key) => keyPatches(path, before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, key));
  const same = before.children.length === after.children.length && before.children.every((child, i) => child.id === after.children[i]?.id);
  if (!same) return [...own, { op: 'replace', path: [...path, 'children'], value: after.children }];
  return [...own, ...before.children.flatMap((child, i) => treePatches([...path, 'children', i], child, after.children[i] as DocNode))];
}

// A list of records with a stable identity (pages by id, components and collections by name): each record patched in
// place while the list keeps the same records in the same order, else the list replaced whole.
function listPatches<T extends object>(path: Path, before: readonly T[], after: readonly T[], same: (a: T, b: T) => boolean, inner: (path: Path, a: T, b: T) => Patch[]): Patch[] {
  if (deepEqual(before, after)) return [];
  if (before.length !== after.length || !before.every((record, i) => same(record, after[i] as T))) return [{ op: 'replace', path, value: after }];
  return before.flatMap((record, i) => inner([...path, i], record, after[i] as T));
}

// The patches of a record's keys, with a tree patched node by node under `treeKey`.
function recordPatches(path: Path, before: object, after: object, treeKey: string | null): Patch[] {
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) =>
    key === treeKey && Object.hasOwn(a, key) && Object.hasOwn(b, key) ? treePatches([...path, key], a[key] as DocNode, b[key] as DocNode) : keyPatches(path, a, b, key),
  );
}

// From one document to another: the pages, components and collections record by record, every other field of the
// project whole.
export function documentPatches(before: DocumentJson, after: DocumentJson): Patch[] {
  const a = before as unknown as Record<string, unknown>;
  const b = after as unknown as Record<string, unknown>;
  const patches: Patch[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const had = Object.hasOwn(a, key) && a[key] !== undefined;
    const has = Object.hasOwn(b, key) && b[key] !== undefined;
    if (key === 'pages') {
      patches.push(...listPatches(['pages'], before.pages, after.pages, (x, y) => x.id === y.id, (path, x, y) => recordPatches(path, x, y, 'tree')));
    } else if (key === 'components' && had && has) {
      patches.push(...listPatches(['components'], before.components ?? [], after.components ?? [], (x, y) => x.name === y.name, (path, x, y) => recordPatches(path, x, y, 'tree')));
    } else if (key === 'collections' && had && has) {
      patches.push(...listPatches(['collections'], before.collections ?? [], after.collections ?? [], (x, y) => x.name === y.name, (path, x, y) => recordPatches(path, x, y, null)));
    } else if (had && !has) {
      patches.push({ op: 'remove', path: [key] });
    } else if (!had && has) {
      patches.push({ op: 'add', path: [key], value: b[key] });
    } else if (had && has && !deepEqual(a[key], b[key])) {
      patches.push({ op: 'replace', path: [key], value: b[key] });
    }
  }
  return patches;
}
