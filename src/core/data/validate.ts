// The content's part of the document model (core/document/validate.ts calls it on every commit and on every load): the
// collections and their values in canonical form, the marks of bound elements, bound lists and item pages, and the
// marks of shared regions. A document that breaks one of these rules is never committed.
import type { DocNode, DocumentJson } from '../document/model.ts';
import type { ModelRules } from '../document/validate.ts';
import { walk } from '../document/model.ts';
import { targetsOf } from './targets.ts';
import { isCanonical, queryRefusal, schemaRefusal } from './collections.ts';
import { BIND_TARGETS, FILTER_OPERATORS, ITEM_PAGE, type BindTarget, type Collection, type Query } from './model.ts';

export interface DataProblem {
  readonly path: string;
  readonly message: string;
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): boolean => value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);

// Why a stored query is not one (its shape; the fields it names are checked against its collection by queryRefusal).
function queryShape(query: unknown): string | null {
  if (!isObject(query)) return 'a query is an object';
  const { filters, match, order, offset, limit, ...rest } = query;
  if (Object.keys(rest).length > 0) return `a query holds only filters, match, order, offset and limit, not ${Object.keys(rest).join(', ')}`;
  if (filters !== undefined && (!Array.isArray(filters) || filters.some((f) => !isObject(f) || typeof f.field !== 'string' || !(FILTER_OPERATORS as readonly unknown[]).includes(f.operator) || (f.value !== undefined && typeof f.value !== 'string')))) return 'a filter names a field, an operator and the text it compares with';
  if (match !== undefined && match !== 'all' && match !== 'any') return 'a query matches all or any of its filters';
  if (order !== undefined && (!Array.isArray(order) || order.some((s) => !isObject(s) || typeof s.field !== 'string' || (s.direction !== 'asc' && s.direction !== 'desc')))) return 'an order names a field and a direction';
  if (!count(offset) || !count(limit)) return 'an offset and a limit are whole numbers';
  return null;
}

function collectionProblems(collection: unknown, at: string, problems: DataProblem[]): void {
  if (!isObject(collection) || typeof collection.name !== 'string' || collection.name.trim() === '' || !Array.isArray(collection.fields) || !Array.isArray(collection.items)) {
    problems.push({ path: at, message: 'a collection has a name, fields and items' });
    return;
  }
  const typed = collection as unknown as Collection;
  const schema = schemaRefusal(typed.name, typed.fields);
  if (schema !== null) problems.push({ path: `${at}/fields`, message: `the schema is not one (${schema.key})` });
  const ids = new Set<string>();
  typed.items.forEach((item, i) => {
    if (!isObject(item) || typeof item.id !== 'string' || item.id === '' || !isObject(item.values)) {
      problems.push({ path: `${at}/items/${i}`, message: 'an item has an id and its values' });
      return;
    }
    if (ids.has(item.id)) problems.push({ path: `${at}/items/${i}/id`, message: `item id "${item.id}" is already used` });
    ids.add(item.id);
    for (const [key, value] of Object.entries(item.values)) {
      const field = typed.fields.find((f) => f.key === key);
      if (field === undefined) problems.push({ path: `${at}/items/${i}/values/${key}`, message: 'a value belongs to a field of its collection' });
      else if (!isCanonical(field.type, value)) problems.push({ path: `${at}/items/${i}/values/${key}`, message: `the value is not a canonical ${field.type}` });
    }
  });
}

function nodeProblems(document: DocumentJson, node: DocNode, at: string, rules: ModelRules, page: boolean, problems: DataProblem[]): void {
  if (node.bind !== undefined) {
    const targets = targetsOf(node, rules);
    if (!Array.isArray(node.bind) || node.bind.length === 0) problems.push({ path: `${at}/bind`, message: 'a binding list holds at least one binding' });
    else {
      const seen = new Set<string>();
      for (const bound of node.bind as readonly unknown[]) {
        const to = isObject(bound) ? bound.to : undefined;
        if (!isObject(bound) || typeof bound.field !== 'string' || bound.field === '' || !(BIND_TARGETS as readonly unknown[]).includes(to)) {
          problems.push({ path: `${at}/bind`, message: 'a binding names a field and a target' });
          continue;
        }
        const target = to as BindTarget;
        if (!targets.includes(target)) problems.push({ path: `${at}/bind`, message: `this element cannot show a value as ${target}` });
        else if (bound.field === ITEM_PAGE && target !== 'link') problems.push({ path: `${at}/bind`, message: "an item's page is a link's address" });
        else if (seen.has(target)) problems.push({ path: `${at}/bind`, message: `two bindings fill ${target}` });
        seen.add(target);
      }
    }
  }
  if (node.dataList !== undefined) {
    const list = node.dataList as unknown;
    if (!isObject(list) || typeof list.collection !== 'string' || typeof list.component !== 'string') problems.push({ path: `${at}/dataList`, message: 'a bound list names its collection and its component' });
    else {
      const shape = queryShape(list.query);
      const collection = document.collections?.find((c) => c.name === list.collection);
      if (shape !== null) problems.push({ path: `${at}/dataList/query`, message: shape });
      else if (collection === undefined) problems.push({ path: `${at}/dataList/collection`, message: `the project has no collection ${String(list.collection)}` });
      else if (queryRefusal(collection, list.query as Query) !== null) problems.push({ path: `${at}/dataList/query`, message: 'the query names a field its collection does not have' });
      if (!(document.components ?? []).some((c) => c.name === list.component)) problems.push({ path: `${at}/dataList/component`, message: `the project has no component ${String(list.component)}` });
    }
  }
  if (node.dataItem !== undefined) {
    const mark = node.dataItem as unknown;
    if (!page) problems.push({ path: `${at}/dataItem`, message: "only a page's root names the item the page is made for" });
    else if (!isObject(mark) || typeof mark.collection !== 'string' || typeof mark.item !== 'string') problems.push({ path: `${at}/dataItem`, message: 'an item page names its collection and its item' });
    else if (!(document.collections ?? []).some((c) => c.name === mark.collection && c.items.some((item) => item.id === mark.item))) problems.push({ path: `${at}/dataItem`, message: 'the item the page is made for is not in its collection' });
  }
}

export function dataProblems(document: DocumentJson, rules: ModelRules): DataProblem[] {
  const problems: DataProblem[] = [];
  const collections = document.collections as unknown;
  if (collections !== undefined) {
    if (!Array.isArray(collections) || collections.length === 0) problems.push({ path: '/collections', message: 'the collections are a list, absent while there is none' });
    else {
      collections.forEach((collection, i) => collectionProblems(collection, `/collections/${i}`, problems));
      const names = collections.map((c: unknown) => (isObject(c) && typeof c.name === 'string' ? c.name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() : ''));
      if (new Set(names).size !== names.length) problems.push({ path: '/collections', message: 'two collections share a name' });
    }
  }
  // a page made for an item stands for one item: two pages never claim the same one
  const claimed = new Set<string>();
  document.pages.forEach((page, p) => {
    const mark = page.tree.dataItem;
    if (mark !== undefined && isObject(mark)) {
      const key = `${String(mark.collection)}\u0000${String(mark.item)}`;
      if (claimed.has(key)) problems.push({ path: `/pages/${p}/tree/dataItem`, message: 'another page is made for this item' });
      claimed.add(key);
    }
    for (const node of walk(page.tree)) nodeProblems(document, node, `/pages/${p}/${node === page.tree ? 'tree' : `node:${node.id}`}`, rules, node === page.tree, problems);
  });
  (document.components ?? []).forEach((definition, c) => {
    for (const node of walk(definition.tree)) nodeProblems(document, node, `/components/${c}/node:${node.id}`, rules, false, problems);
    const shared = definition.shared as unknown;
    if (shared !== undefined && (!isObject(shared) || typeof shared.newPages !== 'boolean' || (shared.at !== 'start' && shared.at !== 'end') || Object.keys(shared).length !== 2)) problems.push({ path: `/components/${c}/shared`, message: 'a shared region says whether new pages receive it and where' });
  });
  return problems;
}
