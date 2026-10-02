// The tree's structure, in one place (ARCHITECTURE.md; the plan's T1): the patches that take a subtree out, put
// children in, and release the references that pointed at what is leaving — and the one test that says whether a move
// would put a node inside itself.
//
// The invariants this module owns are the tree's own, so the commands that move, remove or replace elements cannot
// forget one: a node sits in exactly one place, a reference never points at nothing, a move never targets its own
// subtree. Policy — locks, the content model, names, the words a refusal says — belongs to the commands, which refuse
// before they build anything (a predictable invalid operation never becomes a patch; see the store's commit).
//
// Every function is pure: it reads the document and returns patches, never a new document (the store's one applier
// applies them), so a command can compose several and hand them out in one transaction.
import { locate, walk, type DocNode, type DocumentJson, type NodeId, type Location } from './model.ts';
import { referenceNamesLeaving, referencesOf } from '../elements/references.ts';
import { releaseMotionTargets } from '../motion/document.ts';
import type { Patch, Path } from '../history/transaction.ts';

// The path children of a node take: the parent's own path, then the index among its children.
export function childPath(parentPath: Path, index: number): Path {
  return [...parentPath, 'children', index];
}

// A node taking a place among a parent's children: the index is clamped to what the parent holds, so a caller that
// computed it before another change cannot address beyond the end.
export function insertChild(document: DocumentJson, parentId: NodeId, index: number, node: DocNode): Patch[] {
  const parent = locate(document, parentId);
  if (parent === null) throw new Error(`tree.insertChild: the document has no node ${parentId}`);
  const at = Math.max(0, Math.min(index, parent.node.children.length));
  return [{ op: 'add', path: childPath(parent.path, at), value: node }];
}

// A subtree leaving its place (its paths and its node, as the document holds them now).
export function removeSubtree(at: Location): Patch[] {
  return [{ op: 'remove', path: at.path }];
}

// Whether putting a subtree under this parent would put it inside itself: the parent is the node itself or one of its
// descendants. One rule, read by every move and every wrap (the plan's T1; the refusal's words are the caller's).
export function movesIntoItself(moved: readonly DocNode[], parentId: NodeId): boolean {
  return moved.some((node) => [...walk(node)].some((inner) => inner.id === parentId));
}

// The patches that release every reference pointing at what is leaving: a label's `for`, a link's `#anchor`. What
// leaves is the id of every node going away — the node itself and, when a subtree goes, everything inside it — and no
// node that stays may point at one of them (a reference to nothing is what the validator refuses a document over).
export function releaseReferencesPatch(document: DocumentJson, leaving: ReadonlySet<NodeId>): Patch[] {
  const patches: Patch[] = [];
  for (const reference of referencesOf(document)) {
    // a node that is itself leaving goes with its attributes: nothing to release
    if (leaving.has(reference.node.id)) continue;
    const named = (reference.value.startsWith('#') ? reference.value.slice(1) : reference.value) as NodeId;
    if (!leaving.has(named)) continue;
    const at = locate(document, reference.node.id);
    if (at !== null) patches.push({ op: 'remove', path: [...at.path, 'attributes', reference.attribute] });
  }
  // an interaction that acts on a node that is leaving goes with it: its script would select nothing (the export wrote
  // querySelector(".") for it, which throws)
  for (const page of document.pages) {
    for (const node of walk(page.tree)) {
      if (leaving.has(node.id) || node.interactions === undefined) continue;
      const kept = node.interactions.filter((one) => one.target === undefined || !leaving.has(one.target));
      if (kept.length === node.interactions.length) continue;
      const at = locate(document, node.id);
      if (at !== null) patches.push(kept.length === 0 ? { op: 'remove', path: [...at.path, 'interactions'] } : { op: 'replace', path: [...at.path, 'interactions'], value: kept });
    }
  }
  // a motion action that acts on a picked element that is leaving goes with it (core/motion/document.ts)
  patches.push(...releaseMotionTargets(document, leaving));
  return patches;
}

// The ids of a subtree: the node and everything under it.
export function subtreeIds(node: DocNode): ReadonlySet<NodeId> {
  return new Set([...walk(node)].map((inner) => inner.id as NodeId));
}

// A node and its subtree with every reference to what is leaving taken away.
//
// A patch cannot do this job for a node a command writes back — a re-inserted child, a replaced subtree: the patch
// would have to run before the write (the old paths) and the write puts the value back. So the rule has two shapes,
// both here: patches for the nodes that stay where they are, and this value-level one for the nodes that are written.
export function withoutReferencesTo(node: DocNode, leaving: ReadonlySet<NodeId>): DocNode {
  const attributes = Object.fromEntries(Object.entries(node.attributes).filter(([attribute, value]) => !referenceNamesLeaving(attribute, value, leaving)));
  const children = node.children.map((child) => withoutReferencesTo(child, leaving));
  const changed = children.some((child, i) => child !== node.children[i]);
  const interactions = node.interactions?.filter((one) => one.target === undefined || !leaving.has(one.target));
  const interactionsChanged = interactions !== undefined && interactions.length !== node.interactions?.length;
  if (Object.keys(attributes).length === Object.keys(node.attributes).length && !changed && !interactionsChanged) return node;
  if (!interactionsChanged) return { ...node, attributes, children };
  const rest: Record<string, unknown> = { ...node };
  delete rest.interactions;
  return (interactions.length === 0 ? { ...rest, attributes, children } : { ...rest, attributes, children, interactions }) as unknown as DocNode;
}
