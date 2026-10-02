// The selection (ARCHITECTURE.md, Command owners): which nodes are selected, the primary first. It lives in the
// store beside the document, never in it: selecting changes no document and records no history, and undo and redo
// restore the selection that belonged to the document state they go back to (history.ts).
import { pageShown } from '../project/pages.ts';
import { message, registerHandler, registerPredicate, type Outcome } from '../commands/registry.ts';
import { locate, type DocNode, type DocumentJson, type Location, type NodeId, type Selection } from '../document/model.ts';
import { lockOver } from '../nodes/flags.ts';
import type { StoreState } from '../store/store.ts';
import type { Rect } from '../../generated/commands.ts';

// selection.clear's availability: something is selected (refused with "Select an element first." otherwise)
export const hasSelection = registerPredicate('hasSelection', (state) => state.selection.length > 0);

// A command that acts on the element its door names (a Layers row's eye and lock: `args.target`), else on the
// selection: available when the named element is in the document, or when something is selected
export const targetOrSelection = registerPredicate('targetOrSelection', (state, _rules, args) => {
  const target = args !== null && typeof args === 'object' ? (args as { readonly target?: unknown }).target : undefined;
  if (typeof target === 'string') return locate(state.document, target as NodeId) !== null;
  return state.selection.length > 0;
});

// the availability of a command that acts on one element (element.promote, hand.take): exactly one node is selected
export const singleSelection = registerPredicate('singleSelection', (state) => state.selection.length === 1);

// Whether a node of the document is the selection alone: an edit in place (a text on the canvas, a name in Layers)
// lasts only while its node is.
export const selectedAlone = (document: DocumentJson, selection: Selection, id: NodeId): boolean => selection.length === 1 && selection[0] === id && locate(document, id) !== null;

// selection.select: the node alone becomes the selection; the status bar names it. Every door gives a node of the
// document (a canvas click, a Layers row), so a node the document lacks is a defect of the door.
export const selectCommand = registerHandler('selection.select', ({ state }, { target }) => {
  const found = locate(state.document, target);
  if (!found) throw new Error(`selection.select: the document has no node ${target}`);
  return { kind: 'change', selection: [target], message: message('status.selected', { name: found.node.name }) };
});

// selection.clear: nothing is selected any more
export const clearSelectionCommand = registerHandler('selection.clear', () => ({ kind: 'change', selection: [], message: message('status.selection.cleared') }));

// selection.selectAllInContainer (spec select-container-children): the selected element and every sibling of it
// become the selection, in their order; with nothing selected, or the page root selected, every child of the page.
// A hidden child is left out, and so is a locked one, or one inside a locked element (spec lock-element: the lock
// holds the whole subtree; src/core/nodes/flags.ts), and the status bar counts what it left out (Problems in Pager 2).
export const selectAllInContainerCommand = registerHandler('selection.selectAllInContainer', ({ state }): Outcome<never> => {
  const [primary] = state.selection;
  const at = primary === undefined ? null : locate(state.document, primary);
  const container = at?.parent ?? at?.node ?? pageShown(state)?.tree ?? null;
  if (container === null) return { kind: 'change' };
  const taken = container.children.filter((child) => child.hidden !== true && lockOver(state.document, child.id) === null);
  const skipped = container.children.length - taken.length;
  return {
    kind: 'change',
    selection: taken.map((child) => child.id),
    message: skipped > 0 ? message('status.selection.skipped', { count: taken.length, skipped }) : message('status.selection.count', { count: taken.length }),
  };
});

// selection.marquee (spec marquee-select): the band a drag draws on the canvas takes the direct children of the
// container it started in, each one the band touches (edges included, so a band as thin as a line takes what it
// crosses) — Problems in Pager 3, where a band over the cards of a grid took the leaves inside them instead. The
// container is the deepest node the press hit (a later sibling drawn over an earlier one; the page root holds every
// point), or, for a band started on an element (the Shift door, Problems in Pager 4), the parent of that element, so
// the band works over its siblings. With `leaves` (the take-leaves key held: Alt) the fine rule takes the place: a
// leaf the band touches, a container only when the band holds it entirely, and a taken node takes its descendants'
// place. An element that is locked, inside a locked one, or hidden is never taken, and the ones the band hit are
// counted in the status bar. The band starts at its press point (rect x, y; its width and height run from there to the
// pointer and are negative when the pointer went left or up), and its boxes come from the layout port, in page pixels
// too. The mode says what becomes of the selection the gesture started from: replaced, added to (the selection first,
// then what the band took in document order) or toggled. No document changes and no history is recorded.
type Box = Rect;
const holdsPoint = (b: Box, p: { readonly x: number; readonly y: number }) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
const touches = (a: Box, b: Box) => a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
const holds = (a: Box, b: Box) => b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;

export const marqueeCommand = registerHandler('selection.marquee', ({ state, layout, rules }, { rect, mode, leaves, target }) => {
  // the page the canvas shows: the one whose root it draws
  const page = state.document.pages.find((p) => layout.box(p.tree.id) !== null);
  if (!page) return { kind: 'change' };
  const start = { x: rect.x, y: rect.y };
  const band: Box = { x: Math.min(rect.x, rect.x + rect.width), y: Math.min(rect.y, rect.y + rect.height), width: Math.abs(rect.width), height: Math.abs(rect.height) };
  // the container whose children the band takes
  let scope: DocNode;
  if (target === undefined) {
    scope = page.tree;
    for (;;) {
      const inner: DocNode | undefined = [...scope.children].reverse().find((child) => {
        const box = layout.box(child.id);
        return box !== null && holdsPoint(box, start);
      });
      if (!inner) break;
      scope = inner;
    }
  } else {
    // the element the band started on, and the parent it works over; the page root keeps its own children
    const found = locate(state.document, target);
    if (found === null) throw new Error(`selection.marquee: the document has no node ${target}`);
    scope = found.parent ?? found.node;
  }
  const taken: DocNode[] = [];
  let skipped = 0;
  // an element the lock holds (flags.ts), or a hidden one, is never taken, and the band's hit on it is counted
  const leftOut = (node: DocNode) => node.hidden === true || lockOver(state.document, node.id) !== null;
  if (leaves === true) {
    const visit = (node: DocNode) => {
      const box = layout.box(node.id);
      const container = rules.elements.get(node.type)?.content === 'children';
      if (box !== null && (container ? holds(band, box) : touches(band, box))) {
        if (leftOut(node)) skipped += 1;
        else taken.push(node);
        return;
      }
      if (leftOut(node)) return;
      node.children.forEach(visit);
    };
    scope.children.forEach(visit);
  } else {
    scope.children.forEach((child) => {
      const box = layout.box(child.id);
      if (box === null || !touches(band, box)) return;
      if (leftOut(child)) skipped += 1;
      else taken.push(child);
    });
  }
  const took = taken.map((n) => n.id);
  const base = state.selection;
  const selection =
    mode === 'replace'
      ? took
      : mode === 'add'
        ? [...base, ...took.filter((id) => !base.includes(id))]
        : [...base.filter((id) => !took.includes(id)), ...took.filter((id) => !base.includes(id))];
  // the status bar names a single node, counts several, says when none is left, as for a click, and counts what the
  // lock or the eye kept out
  if (skipped > 0) return { kind: 'change', selection, message: message('status.selection.skipped', { count: selection.length, skipped }) };
  return several(state, selection);
});

// A selection of several nodes (spec multi-select-click): the nodes in the order they were selected, the primary
// first. The status bar names a single node, counts several, and says when none is left.
function several(state: StoreState<never>, selection: StoreState<never>['selection']): Outcome<never> {
  const only = selection.length === 1 && selection[0] !== undefined ? locate(state.document, selection[0]) : null;
  const said =
    selection.length === 0 ? message('status.selection.cleared') : only !== null ? message('status.selected', { name: only.node.name }) : message('status.selection.count', { count: selection.length });
  return { kind: 'change', selection, message: said };
}
function known(state: StoreState<never>, target: string) {
  // every door gives a node of the document (a canvas click, a Layers row), so a node the document lacks is a
  // defect of the door
  if (!locate(state.document, target)) throw new Error(`adding to the selection: the document has no node ${target}`);
}

// selection.range (Shift+click on a Layers row; jornada03 J17): from the node selected last to the one clicked, every
// sibling between them joins the selection, in the order from that node to the clicked one, as a file tree selects a
// run of rows. Rows of different parents are no run: the clicked node joins the selection as with Shift+click on the
// canvas (selection.add). With nothing selected it is selected alone.
export const rangeCommand = registerHandler('selection.range', ({ state }, { target }) => {
  known(state, target);
  const anchorId = state.selection.at(-1);
  if (anchorId === undefined) return several(state, [target]);
  const anchor = locate(state.document, anchorId);
  const clicked = locate(state.document, target);
  if (anchor === null || clicked === null || clicked.parent === null || anchor.parent?.id !== clicked.parent.id) {
    return several(state, state.selection.includes(target) ? state.selection : [...state.selection, target]);
  }
  const [from, to] = anchor.index <= clicked.index ? [anchor.index, clicked.index] : [clicked.index, anchor.index];
  const run = clicked.parent.children.slice(from, to + 1).map((node) => node.id);
  const ordered = anchor.index <= clicked.index ? run : [...run].reverse();
  return several(state, [...state.selection.filter((id) => !ordered.includes(id)), ...ordered]);
});

// selection.add (Shift+click): the node joins the selection after the nodes already in it; a node already selected
// stays where it is (Shift+click adds and never removes, spec Problems in Pager 2)
export const addCommand = registerHandler('selection.add', ({ state }, { target }) => {
  known(state, target);
  return several(state, state.selection.includes(target) ? state.selection : [...state.selection, target]);
});

// selection.toggle (Ctrl+click): a selected node leaves the selection, any other joins it after the others (spec
// Problems in Pager 1)
export const toggleCommand = registerHandler('selection.toggle', ({ state }, { target }) => {
  known(state, target);
  return several(state, state.selection.includes(target) ? state.selection.filter((id) => id !== target) : [...state.selection, target]);
});

// The walk of the tree with the arrow keys (spec keyboard-tree-walk): one level per key from the primary node, the
// node reached alone becomes the selection and the status bar names it; at an end the selection stays and the status
// bar says why. Siblings are the parent's children, hidden or locked included; the page root is reached from its
// children and has no parent. With nothing selected any arrow starts the walk at the open page's root (jornada03
// plan, stage 5: "setas sem seleção começam pela raiz"; they said "Select an element first."). Walking changes no
// document and records no history.
function walkFrom(state: StoreState<never>): Location | null {
  const primary = state.selection[0];
  if (primary === undefined) return null;
  const found = locate(state.document, primary);
  // a selected node the document lacks is a defect of the store
  if (!found) throw new Error('a walk of the tree: the selection names no node of the document');
  return found;
}
const reach = (node: DocNode): Outcome<never> => ({ kind: 'change', selection: [node.id], message: message('status.selected', { name: node.name }) });
// the start of a walk with nothing selected: the open page's root
function start(state: StoreState<never>): Outcome<never> {
  const root = pageShown(state)?.tree;
  if (root === undefined) throw new Error('a walk of the tree: the document has no page');
  return reach(root);
}

// selection.walkNextSibling (ArrowRight): the next sibling; refused on the last child and on the page root
export const walkNextSiblingCommand = registerHandler('selection.walkNextSibling', ({ state }) => {
  const at = walkFrom(state);
  if (at === null) return start(state);
  const next = at.parent?.children[at.index + 1];
  if (next) return reach(next);
  return { kind: 'refused', message: message('status.walk.noNext', { parent: at.parent?.name ?? state.document.pages[at.page]?.name ?? '' }) };
});

// selection.walkPreviousSibling (ArrowLeft): the previous sibling; refused on the first child and on the page root
export const walkPreviousSiblingCommand = registerHandler('selection.walkPreviousSibling', ({ state }) => {
  const at = walkFrom(state);
  if (at === null) return start(state);
  const previous = at.index > 0 ? at.parent?.children[at.index - 1] : undefined;
  if (previous) return reach(previous);
  return { kind: 'refused', message: message('status.walk.noPrevious', { parent: at.parent?.name ?? state.document.pages[at.page]?.name ?? '' }) };
});

// selection.walkParent (ArrowUp): the parent, the page root included (unlike Pager); refused at the page root
export const walkParentCommand = registerHandler('selection.walkParent', ({ state }) => {
  const at = walkFrom(state);
  if (at === null) return start(state);
  if (at.parent) return reach(at.parent);
  return { kind: 'refused', message: message('status.walk.atRoot') };
});

// selection.walkFirstChild (ArrowDown): the first child; refused on a node without children
export const walkFirstChildCommand = registerHandler('selection.walkFirstChild', ({ state }) => {
  const at = walkFrom(state);
  if (at === null) return start(state);
  const first = at.node.children[0];
  if (first) return reach(first);
  return { kind: 'refused', message: message('status.walk.noChildren', { name: at.node.name }) };
});
