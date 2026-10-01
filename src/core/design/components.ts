// The project's components (ARCHITECTURE.md, Command owners; spec reusable-components): a component is a named
// definition, a tree of elements kept with the project (the document's `components`), whose instances are real
// subtrees of pages. An instance's root names its component (`component`); each of its elements records the place of the
// definition element it comes from (`componentPart`, the child indexes from the definition's root). The one owner of:
//  - components.create: the one selected element and its subtree become a new component's definition (new ids), named
//    after the element (numbered when the project has a component of that name); the element becomes its first
//    instance. The page root (status.components.root), an instance or an element inside one
//    (status.components.inInstance) and a locked element (status.locked.edit) are refused.
//  - components.insertInstance: a new instance (the definition's elements, each with a new id and a name no element
//    has) placed as element.insert places a tile (core/structure/insert.ts placement), refused as an element is
//    (content-model.ts placementRefusal, a locked parent); it becomes the selection.
//  - components.detach (predicate instanceSelected): the instance's elements forget their component and their parts.
//  - components.repeat (spec repeat-element): the one selected element gains a linked copy right after it, a new
//    instance of its component; an element that is not one yet first becomes a component (as components.create makes
//    one, named after it) and its first instance. The new item becomes the selection, so the command run again adds
//    the next. Styles are the component's, so a style written on any repeated item reaches them all; a text or an
//    attribute stays on its item.
//  - components.fillFromData (spec repeat-element, Fill from data): the repeated items of the selected one (the
//    instances of its component in its parent, in order) take the rows of a project data file (core/design/data.ts),
//    one row each: a field of an item (an element that holds text, an image's source) takes the value named like its
//    definition element, else the value at its place; rows beyond the items add new items after the last one.
//  - componentHolders: where a style write on an element of an instance goes (core/style/set.ts styleHolders): the
//    definition's element and the same element of every instance of the component, in every page.
import type { NodeId } from '../../generated/commands.ts';
import { message, registerHandler, registerPredicate, type Message, type Outcome } from '../commands/registry.ts';
import { lineage, locate, type ComponentDefinition, type DocNode, type DocumentJson } from '../document/model.ts';
import type { ModelRules } from '../document/validate.ts';
import { refreshCopiedIdentities } from '../document/clone.ts';
import { placementRefusal } from '../elements/content-model.ts';
import type { Patch } from '../history/transaction.ts';
import { deepEqual } from '../history/transaction.ts';
import { lockRefusal } from '../nodes/flags.ts';
import { nodeMaker, placement, type NodeMaker } from '../structure/insert.ts';
import { copyName } from '../structure/duplicate.ts';
import { fileAt, imageFiles, isProjectPath } from '../files/files.ts';
import { readAddress } from '../elements/address.ts';
import { dataRows, type DataRow } from './data.ts';

const NONE: readonly ComponentDefinition[] = [];
export const componentsOf = (document: DocumentJson): readonly ComponentDefinition[] => document.components ?? NONE;

// the root of the instance a node lies in (the node itself or an ancestor naming a component), or null
export function instanceRootOf(document: DocumentJson, id: NodeId): DocNode | null {
  return lineage(document, id).findLast((node) => node.component !== undefined) ?? null;
}

// An element of a tree as the elements of an instance: its part given, its children's after it; the root names the
// component.
function marked(node: DocNode, part: readonly number[], component: string | null): DocNode {
  const { component: _c, componentPart: _p, ...plain } = node;
  void _c;
  void _p;
  return { ...plain, ...(component !== null ? { component } : {}), componentPart: part, children: node.children.map((child, i) => marked(child, [...part, i], null)) };
}

// An element of an instance as an ordinary element: no component, no part, down its subtree.
function unmarked(node: DocNode): DocNode {
  const { component: _c, componentPart: _p, ...plain } = node;
  void _c;
  void _p;
  return { ...plain, children: node.children.map(unmarked) };
}

// Why an element cannot become a component, or null when it can (the audit's A3.12: the prompt asks the same question
// the create answers): the page root, an element inside an instance, a locked element, or one inside a locked one.
export function createRefusal(document: DocumentJson, id: NodeId): Message | null {
  const found = locate(document, id);
  if (found === null) return null;
  if (found.parent === null) return message('status.components.root');
  if (instanceRootOf(document, found.node.id as NodeId) !== null) return message('status.components.inInstance', { name: found.node.name });
  return lockRefusal(document, found.node.id as NodeId, 'status.locked.edit');
}

// A copy of a tree with new ids (and, given a maker, names no element has), with no instance marks. A copy's name is
// the name a duplicate's copy takes (core/structure/duplicate.ts copyName: a name that ends in a number counts on, so
// "Button 4" copies to "Button 5" and never to "Button 4 2" — the user's real-use audit, item A3.12). The root's name
// is the caller's (an instance is named after its component): `root` leaves it for the caller to set.
function copied(node: DocNode, next: () => NodeId, make: NodeMaker | null, root = false): DocNode {
  const plain = unmarked(node);
  const name = make === null || root ? plain.name : copyName(plain.name, make.taken);
  if (make !== null && !root) make.taken.add(name);
  const children = node.children.map((child) => copied(child, next, make));
  return { ...plain, id: next(), name, children };
}

// the next free component name: the base, else the base and the first free number from 2
function componentName(document: DocumentJson, base: string): string {
  const taken = new Set(componentsOf(document).map((c) => c.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export const createComponentCommand = registerHandler('components.create', ({ state, ids }, { name: typed }): Outcome<never> => {
  const primary = state.selection[0];
  const found = primary === undefined ? null : locate(state.document, primary);
  if (found === null) return { kind: 'change' };
  const refusedHere = createRefusal(state.document, found.node.id as NodeId);
  if (refusedHere !== null) return { kind: 'refused', message: refusedHere };
  // the name the prompt asked for (the audit's A3.12), the element's own when it asked for none or typed none
  const asked = typeof typed === 'string' ? typed.trim() : '';
  const name = componentName(state.document, asked === '' ? found.node.name : asked);
  const plainCopy = copied(found.node, () => ids.next() as NodeId, null);
  const definitionTree = refreshCopiedIdentities(state.document, [{ source: found.node, copy: plainCopy }], false)[0];
  if (definitionTree === undefined) throw new Error('components.create: the definition copy is missing');
  const definition: ComponentDefinition = { name, tree: definitionTree };
  const added: Patch = state.document.components === undefined ? { op: 'add', path: ['components'], value: [definition] } : { op: 'add', path: ['components', componentsOf(state.document).length], value: definition };
  return { kind: 'change', patches: [added, { op: 'replace', path: found.path, value: marked(found.node, [], name) }], message: message('status.components.created', { name }) };
});

export const insertInstanceCommand = registerHandler('components.insertInstance', ({ state, ids, rules, words }, { component, parent, index }): Outcome<never> => {
  const definition = componentsOf(state.document).find((c) => c.name === component);
  // every tile stands for a component of the project, so an unknown one is a defect of the door
  if (definition === undefined) throw new Error(`components.insertInstance: the project has no component ${component}`);
  const at = placement(state, state.selection, rules, parent, index);
  if (at === null) throw new Error(`components.insertInstance: the document has no node ${String(parent)}`);
  const receiver = at.parent.node;
  const locked = lockRefusal(state.document, receiver.id, 'status.locked.insert');
  if (locked !== null) return { kind: 'refused', message: locked };
  const make = nodeMaker(state.document, rules, ids, words);
  // the instance is named after its component, with a simple number (the audit's A3.12): "Card", "Card 2", "Card 3"
  const name = copyName(definition.name, make.taken);
  make.taken.add(name);
  const plainCopy = copied(definition.tree, () => ids.next() as NodeId, make, true);
  const copiedTree = refreshCopiedIdentities(state.document, [{ source: definition.tree, copy: plainCopy }])[0];
  if (copiedTree === undefined) throw new Error('components.insertInstance: the instance copy is missing');
  const node = marked({ ...copiedTree, name }, [], definition.name);
  // an instance lies inside no other instance
  const host = instanceRootOf(state.document, receiver.id);
  if (host !== null) return { kind: 'refused', message: message('status.components.inInstance', { name: receiver.name }) };
  const refused = placementRefusal(state.document, rules, receiver.id, [node]);
  if (refused !== null) return { kind: 'refused', message: refused };
  return {
    kind: 'change',
    patches: [{ op: 'add', path: [...at.parent.path, 'children', at.index], value: node }],
    selection: [node.id],
    message: message('status.placed', { element: node.name, parent: receiver.name, position: at.index + 1, count: receiver.children.length + 1 }),
  };
});

export const repeatCommand = registerHandler('components.repeat', ({ state, ids, rules, words }): Outcome<never> => {
  const primary = state.selection[0];
  const found = primary === undefined ? null : locate(state.document, primary);
  if (found === null) return { kind: 'change' };
  if (found.parent === null) return { kind: 'refused', message: message('status.components.root') };
  const patches: Patch[] = [];
  let definition = found.node.component === undefined ? undefined : componentsOf(state.document).find((c) => c.name === found.node.component);
  if (definition === undefined) {
    // not an instance yet: it becomes a component and its first instance, as components.create makes it
    const refusedHere = createRefusal(state.document, found.node.id as NodeId);
    if (refusedHere !== null) return { kind: 'refused', message: refusedHere };
    const name = componentName(state.document, found.node.name);
    const plainCopy = copied(found.node, () => ids.next() as NodeId, null);
    const tree = refreshCopiedIdentities(state.document, [{ source: found.node, copy: plainCopy }], false)[0];
    if (tree === undefined) throw new Error('components.repeat: the definition copy is missing');
    definition = { name, tree };
    patches.push(state.document.components === undefined ? { op: 'add', path: ['components'], value: [definition] } : { op: 'add', path: ['components', componentsOf(state.document).length], value: definition });
    patches.push({ op: 'replace', path: found.path, value: marked(found.node, [], name) });
  } else {
    const locked = lockRefusal(state.document, found.node.id as NodeId, 'status.locked.edit');
    if (locked !== null) return { kind: 'refused', message: locked };
  }
  const receiver = found.parent;
  const lockedParent = lockRefusal(state.document, receiver.id, 'status.locked.insert');
  if (lockedParent !== null) return { kind: 'refused', message: lockedParent };
  const make = nodeMaker(state.document, rules, ids, words);
  const name = copyName(found.node.name, make.taken);
  make.taken.add(name);
  const plainCopy = copied(definition.tree, () => ids.next() as NodeId, make, true);
  const copiedTree = refreshCopiedIdentities(state.document, [{ source: definition.tree, copy: plainCopy }])[0];
  if (copiedTree === undefined) throw new Error('components.repeat: the instance copy is missing');
  const node = marked({ ...copiedTree, name }, [], definition.name);
  const refused = placementRefusal(state.document, rules, receiver.id, [node]);
  if (refused !== null) return { kind: 'refused', message: refused };
  patches.push({ op: 'add', path: [...found.path.slice(0, -1), found.index + 1], value: node });
  // the items the parent holds now: the instances of the component among its children, the new one with them
  const count = receiver.children.filter((child) => child.id === found.node.id || child.component === definition.name).length + 1;
  return { kind: 'change', patches, selection: [node.id], message: message('status.components.repeated', { name: definition.name, count }) };
});

// The fields an item fills (jornada03 J1/C4: the first column went into the image source by position and the whole
// fill failed silently): an element holding text and an image's source, in document order, each named by the
// definition element it comes from.
interface Field {
  readonly part: string;
  readonly name: string;
  readonly image: boolean;
}
function fieldsOf(definition: ComponentDefinition, rules: ModelRules): readonly Field[] {
  const found: Field[] = [];
  const visit = (node: DocNode, part: readonly number[]) => {
    const content = rules.elements.get(node.type)?.content;
    if (node.type === IMAGE) found.push({ part: JSON.stringify(part), name: node.name.trim().toLowerCase(), image: true });
    else if (content === 'text' && node.children.length === 0) found.push({ part: JSON.stringify(part), name: node.name.trim().toLowerCase(), image: false });
    node.children.forEach((child, index) => visit(child, [...part, index]));
  };
  visit(definition.tree, []);
  return found;
}

// What a cell names as an image: a file of the project by its path, a project image by its file name (any case, with
// or without its extension: "graos.png" or "graos" for img/graos.png), or an address of the web; null for anything else.
const IMAGE_NAME = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/iu;
const WEB_ADDRESS = /^https?:\/\//iu;
export function imageSource(document: DocumentJson, value: string): string | null {
  const typed = value.trim();
  if (typed === '') return null;
  if (isProjectPath(document, typed)) return typed;
  const lowered = typed.toLowerCase();
  const named = imageFiles(document).find((file) => {
    const name = (file.path.split('/').pop() ?? '').toLowerCase();
    return name === lowered || name.replace(/\.[^.]+$/u, '') === lowered;
  });
  if (named !== undefined) return named.path;
  return WEB_ADDRESS.test(typed) && readAddress(typed).ok ? typed : null;
}

// Which column each field takes, the same for every row: the column named like the field (any case), else the next
// column not taken yet of the field's kind (a column whose every filled cell names an image goes to images, any other
// to texts), in the columns' order.
function columnsOf(fields: readonly Field[], rows: readonly DataRow[], document: DocumentJson): ReadonlyMap<string, number> {
  const names = (rows[0]?.names ?? []).map((name) => name.trim().toLowerCase());
  const width = Math.max(names.length, ...rows.map((row) => row.values.length));
  const imageColumn = (column: number): boolean => {
    const cells = rows.map((row) => (row.values[column] ?? '').trim()).filter((cell) => cell !== '');
    return cells.length > 0 && cells.every((cell) => imageSource(document, cell) !== null || IMAGE_NAME.test(cell));
  };
  const kinds = Array.from({ length: width }, (_, column) => imageColumn(column));
  const taken = new Set<number>();
  const chosen = new Map<string, number>();
  for (const field of fields) {
    const named = field.name === '' ? -1 : names.indexOf(field.name);
    if (named >= 0 && !taken.has(named)) {
      taken.add(named);
      chosen.set(field.part, named);
    }
  }
  for (const field of fields) {
    if (chosen.has(field.part)) continue;
    const next = kinds.findIndex((image, column) => image === field.image && !taken.has(column));
    if (next < 0) continue;
    taken.add(next);
    chosen.set(field.part, next);
  }
  return chosen;
}

// An item filled with a row: each field takes its column's cell; a field the row has no value for keeps its own. An
// image cell that names no image of the project nor of the web is refused, naming the row, the column and the cell,
// before any patch (never a source the model refuses).
function filled(item: DocNode, row: DataRow, at: number, columns: ReadonlyMap<string, number>, document: DocumentJson, rules: ModelRules): DocNode | Message {
  let refusal: Message | null = null;
  const visit = (node: DocNode): DocNode => {
    const content = rules.elements.get(node.type)?.content;
    const column = columns.get(JSON.stringify(node.componentPart ?? []));
    const value = column === undefined ? undefined : row.values[column];
    let next: DocNode = node;
    if (node.type === IMAGE) {
      if (value !== undefined && value.trim() !== '') {
        const source = imageSource(document, value);
        if (source === null) refusal ??= message('status.data.imageNotFound', { row: at + 1, column: row.names[column ?? 0] || String((column ?? 0) + 1), value: value.trim() });
        else next = { ...node, attributes: { ...node.attributes, src: source } };
      }
    } else if (content === 'text' && node.children.length === 0 && value !== undefined) {
      next = { ...node, text: value };
    }
    return { ...next, children: next.children.map(visit) };
  };
  const result = visit(item);
  return refusal ?? result;
}
const IMAGE = 'image';
const isMessage = (value: DocNode | Message): value is Message => !('children' in value);

export const fillFromDataCommand = registerHandler('components.fillFromData', ({ state, ids, rules, words }, { path }): Outcome<never> => {
  const primary = state.selection[0];
  const found = primary === undefined ? null : locate(state.document, primary);
  if (found === null || found.parent === null || found.node.component === undefined) return { kind: 'refused', message: message('status.components.notInstance') };
  const definition = componentsOf(state.document).find((c) => c.name === found.node.component);
  if (definition === undefined) return { kind: 'refused', message: message('status.components.notInstance') };
  const file = fileAt(state.document, path);
  const rows = file === null ? null : dataRows(file);
  if (rows === null) return { kind: 'refused', message: message('status.data.unreadable', { path }) };
  const parent = found.parent;
  const lockedParent = lockRefusal(state.document, parent.id, 'status.locked.edit');
  if (lockedParent !== null) return { kind: 'refused', message: lockedParent };
  const parentPath = found.path.slice(0, -1);
  const items = parent.children.map((child, index) => ({ child, index })).filter(({ child }) => child.component === definition.name);
  const columns = columnsOf(fieldsOf(definition, rules), rows, state.document);
  const patches: Patch[] = [];
  for (const [i, { child, index }] of items.entries()) {
    const row = rows[i];
    if (row === undefined) continue;
    const next = filled(child, row, i, columns, state.document, rules);
    if (isMessage(next)) return { kind: 'refused', message: next };
    if (!deepEqual(next, child)) patches.push({ op: 'replace', path: [...parentPath, index], value: next });
  }
  // rows beyond the items: new items after the last one, each a fresh instance filled with its row
  const last = items.at(-1)?.index ?? found.index;
  const make = nodeMaker(state.document, rules, ids, words);
  let before = found.node.name;
  for (const [i, row] of rows.slice(items.length).entries()) {
    const name = copyName(before, make.taken);
    make.taken.add(name);
    before = name;
    const plainCopy = copied(definition.tree, () => ids.next() as NodeId, make, true);
    const tree = refreshCopiedIdentities(state.document, [{ source: definition.tree, copy: plainCopy }])[0];
    if (tree === undefined) throw new Error('components.fillFromData: the instance copy is missing');
    const next = filled(marked({ ...tree, name }, [], definition.name), row, items.length + i, columns, state.document, rules);
    if (isMessage(next)) return { kind: 'refused', message: next };
    patches.push({ op: 'add', path: [...parentPath, last + 1 + i], value: next });
  }
  return { kind: 'change', patches, message: message('status.data.filled', { name: definition.name, count: rows.length, path }) };
});

// the one selected element is an instance's root
export const instanceSelected = registerPredicate('instanceSelected', (state) => {
  const [only, ...others] = state.selection;
  return only !== undefined && others.length === 0 && locate(state.document, only)?.node.component !== undefined;
});

export const detachInstanceCommand = registerHandler('components.detach', ({ state }): Outcome<never> => {
  const primary = state.selection[0];
  const found = primary === undefined ? null : locate(state.document, primary);
  if (found === null || found.node.component === undefined) return { kind: 'change' };
  return { kind: 'change', patches: [{ op: 'replace', path: found.path, value: unmarked(found.node) }], message: message('status.components.detached', { name: found.node.name }) };
});

// What a style write on an element goes to, when the element belongs to an instance: the definition's element (its
// path in the project's components, its parent there) and the element of the same part of every instance of the
// component in every page; null for an element of no instance, or one added to its instance alone.
export function componentHolders(document: DocumentJson, id: NodeId): { readonly node: DocNode; readonly path: readonly (string | number)[]; readonly parent: DocNode | null }[] | null {
  const found = locate(document, id);
  const part = found?.node.componentPart;
  const root = found === null ? null : instanceRootOf(document, found.node.id as NodeId);
  if (found === null || part === undefined || root === null || root.component === undefined) return null;
  const index = componentsOf(document).findIndex((c) => c.name === root.component);
  const definition = componentsOf(document)[index];
  if (definition === undefined) return null;
  // the definition's element of that part, and its parent
  let node: DocNode | undefined = definition.tree;
  let parent: DocNode | null = null;
  const path: (string | number)[] = ['components', index, 'tree'];
  for (const i of part) {
    parent = node ?? null;
    node = node?.children[i];
    path.push('children', i);
  }
  if (node === undefined) return null;
  const holders = [{ node, path, parent }];
  // the same part of every instance of the component
  const visit = (at: DocNode, atPath: (string | number)[], atParent: DocNode | null, instanceOf: string | null) => {
    const within = at.component ?? instanceOf;
    if (within === root.component && at.componentPart !== undefined && deepEqual(at.componentPart, part)) holders.push({ node: at, path: atPath, parent: atParent });
    at.children.forEach((child, i) => visit(child, [...atPath, 'children', i], at, within));
  };
  document.pages.forEach((page, i) => visit(page.tree, ['pages', i, 'tree'], null, null));
  return holders;
}
