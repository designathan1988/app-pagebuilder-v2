// A stylesheet read into the document's styles (PRODUCT.md §5; the manifest's explorer-open-folder): the one reader
// of a whole stylesheet — its rules, and where each rule lands on the document. The document JSON is the source of
// truth, so the rules are not kept as a sheet beside it: a rule whose selectors are single classes lands in the
// project's class registry (core/design/classes.ts), so its users wear it as an ordinary class, and every other rule
// lands on the styles of the elements it matches, at the base breakpoint and style state (the model's own layer,
// rules.baseLayer).
//
// The declarations of a rule are read by the one owner of a declarations text (core/style/custom.ts parseDeclarations):
// a shorthand is expanded into its longhands by its codec, a custom property is kept, a url() goes through the one rule
// of an address, and a property the model does not edit is refused — dropped, never invented. What the reader cannot
// place is dropped and counted, and the import report lists the count: an at-rule (@media, @supports, @font-face), a
// selector it does not understand (a pseudo-class, an attribute selector), and a declaration the model refuses.
import { IDENTIFIER_SOURCE } from '../text/identifier.ts';
import type { HandlerContext } from '../commands/registry.ts';
import type { DocumentJson, DocNode } from '../document/model.ts';
import { parseDeclarations } from '../style/custom.ts';

// a compound selector: its type, its id and its classes
interface Compound {
  readonly tag: string | null;
  readonly id: string | null;
  readonly classes: readonly string[];
}
// a part of a selector: a compound and the combinator that ties it to the one before
interface Part {
  readonly combinator: ' ' | '>';
  readonly compound: Compound;
}

const CLASS = new RegExp(`^\\.(${IDENTIFIER_SOURCE})$`, 'u');
const ID = /^#([\w-]+)$/;

// One compound of a selector ("h1.card#hero", "*"): its type, its id and its classes; null when it holds anything the
// reader does not understand (a pseudo-class, an attribute selector, a namespace).
function compoundOf(text: string): Compound | null {
  if (text === '*') return { tag: null, id: null, classes: [] };
  const tag = /^([a-zA-Z][\w-]*)/.exec(text)?.[1] ?? null;
  let rest = text.slice(tag === null ? 0 : tag.length);
  if (tag === null && rest === '') return null;
  let id: string | null = null;
  const classes: string[] = [];
  while (rest !== '') {
    const part = /^([.#][\w-]*)/.exec(rest)?.[1];
    if (part === undefined) return null;
    if (part.startsWith('#')) {
      if (id !== null || !ID.test(part)) return null;
      id = part.slice(1);
    } else {
      if (!CLASS.test(part)) return null;
      classes.push(part.slice(1));
    }
    rest = rest.slice(part.length);
  }
  return { tag, id, classes };
}

// A whole selector ("h1 .card > p") as its compounds and combinators; null when a part is not understood.
export function selectorOf(text: string): readonly Part[] | null {
  const words = text.trim().split(/\s+/).filter((word) => word !== '');
  const parts: Part[] = [];
  let combinator: ' ' | '>' = ' ';
  for (const word of words) {
    if (word === '>') {
      if (parts.length === 0) return null;
      combinator = '>';
      continue;
    }
    const compound = compoundOf(word);
    if (compound === null) return null;
    parts.push({ combinator, compound });
    combinator = ' ';
  }
  return parts.length === 0 || combinator === '>' ? null : parts;
}

// whether a node wears a compound: its tag, its id attribute and every class it names
function wears(node: DocNode, compound: Compound): boolean {
  if (compound.tag !== null && node.tag !== compound.tag) return false;
  if (compound.id !== null && node.attributes.id !== compound.id) return false;
  return compound.classes.every((name) => node.classes.includes(name));
}

// whether a node matches a selector, with its ancestors (root first, the node last)
function matches(chain: readonly DocNode[], parts: readonly Part[]): boolean {
  const node = chain[chain.length - 1];
  const last = parts[parts.length - 1];
  if (node === undefined || last === undefined || !wears(node, last.compound)) return false;
  let at = chain.length - 2;
  for (let i = parts.length - 2; i >= 0; i -= 1) {
    const part = parts[i] as Part;
    if (parts[i + 1]?.combinator === '>') {
      const parent = chain[at];
      if (parent === undefined || !wears(parent, part.compound)) return false;
      at -= 1;
    } else {
      for (at -= 1; at >= 0 && !wears(chain[at] as DocNode, part.compound); at -= 1);
      if (at < 0) return false;
    }
  }
  return true;
}

export interface SheetRule {
  // the selector list, as written, split on its commas
  readonly selectors: readonly string[];
  // its declaration block, as written
  readonly block: string;
}
export interface Sheet {
  readonly rules: readonly SheetRule[];
  // the rules the reader could not read (an at-rule, a block that holds none): counted, never invented
  readonly dropped: number;
}

// A stylesheet's rules, in source order: comments and strings respected; an at-rule is dropped and counted.
export function readSheet(text: string): Sheet {
  const rules: SheetRule[] = [];
  let dropped = 0;
  let at = 0;
  let start = 0;
  let quote: string | null = null;
  for (; at < text.length; at += 1) {
    const char = text[at] as string;
    if (quote !== null) {
      if (char === '\\') at += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '/' && text[at + 1] === '*') {
      const end = text.indexOf('*/', at + 2);
      at = end < 0 ? text.length : end + 1;
      // a comment before a rule is no part of its selector
      if (end < 0) start = text.length;
      else if (start < end + 2) start = end + 2;
      continue;
    }
    if (char !== '{') {
      if (char === '}' && text.slice(start, at).trim() !== '') {
        // a stray brace between rules: nothing of a rule stands there
        dropped += 1;
        start = at + 1;
      }
      continue;
    }
    const selector = text.slice(start, at).trim();
    // the block up to its matching brace, strings respected
    let inner = at + 1;
    let braces = 1;
    let innerQuote: string | null = null;
    for (; inner < text.length && braces > 0; inner += 1) {
      const held = text[inner] as string;
      if (innerQuote !== null) {
        if (held === '\\') inner += 1;
        else if (held === innerQuote) innerQuote = null;
        continue;
      }
      if (held === '"' || held === "'") innerQuote = held;
      else if (held === '{') braces += 1;
      else if (held === '}') braces -= 1;
    }
    const block = text.slice(at + 1, braces === 0 ? inner - 1 : inner);
    const selectors = selector.split(',').map((one) => one.trim()).filter((one) => one !== '');
    if (selector.startsWith('@') || selectors.length === 0) dropped += 1;
    else rules.push({ selectors, block });
    at = inner - 1;
    start = inner;
  }
  if (text.slice(start).trim() !== '') dropped += 1;
  return { rules, dropped };
}

// The declarations a block holds, read by the one owner of a declarations text; what it refuses is dropped, one
// declaration at a time, so one bad property never takes its neighbours away.
function declarationsIn(block: string, context: HandlerContext<unknown>): { readonly declarations: ReadonlyMap<string, string>; readonly dropped: number } {
  const whole = parseDeclarations(block, context);
  if ('declarations' in whole) return { declarations: whole.declarations, dropped: 0 };
  const declarations = new Map<string, string>();
  let dropped = 0;
  for (const piece of block.split(';')) {
    if (piece.trim() === '') continue;
    const read = parseDeclarations(piece, context);
    if ('declarations' in read) for (const [property, value] of read.declarations) declarations.set(property, value);
    else dropped += 1;
  }
  return { declarations, dropped };
}

export interface Placed {
  readonly document: DocumentJson;
  // the rules and declarations the sheet could not place: what the import report counts
  readonly dropped: number;
}

// The document with the sheet's rules placed on it, in source order (a later declaration wins). A rule whose every
// selector is a single class lands in the class registry; every other rule lands on the elements it matches.
export function placeSheet(document: DocumentJson, sheet: Sheet, context: HandlerContext<unknown>): Placed {
  const { breakpoint, state } = context.rules.baseLayer;
  let held = document;
  let dropped = sheet.dropped;
  for (const rule of sheet.rules) {
    const parsed = rule.selectors.map((one) => selectorOf(one));
    if (parsed.some((one) => one === null)) {
      dropped += 1;
      continue;
    }
    const parts = parsed as readonly (readonly Part[])[];
    const { declarations, dropped: refused } = declarationsIn(rule.block, context);
    dropped += refused;
    if (declarations.size === 0) continue;
    // one class alone, or a list of such classes: the project's class registry
    const single = parts.every((one) => one.length === 1 && one[0]?.compound.tag === null && one[0]?.compound.id === null && one[0].compound.classes.length === 1);
    if (single) {
      for (const name of new Set(parts.map((one) => (one[0] as Part).compound.classes[0] as string))) held = withClassStyles(held, name, declarations, breakpoint, state);
      continue;
    }
    // the elements any of the selectors matches, wherever they stand
    const wanted = new Set<string>();
    for (const page of held.pages) {
      const visit = (node: DocNode, chain: readonly DocNode[]): void => {
        const walked = [...chain, node];
        if (parts.some((one) => matches(walked, one))) wanted.add(node.id);
        for (const child of node.children) visit(child, walked);
      };
      visit(page.tree, []);
    }
    if (wanted.size === 0) continue;
    held = { ...held, pages: held.pages.map((page) => ({ ...page, tree: mapTree(page.tree, (node) => (wanted.has(node.id) ? withStyles(node, declarations, breakpoint, state) : node)) })) };
  }
  return { document: held, dropped };
}

// the tree with a rewrite applied to every node
function mapTree(node: DocNode, rewrite: (node: DocNode) => DocNode): DocNode {
  const mapped = node.children.map((child) => mapTree(child, rewrite));
  const held = node.children.some((child, i) => child !== mapped[i]) ? { ...node, children: mapped } : node;
  return rewrite(held);
}

// one node with the declarations merged into its own styles at the breakpoint and state
function withStyles(node: DocNode, declarations: ReadonlyMap<string, string>, breakpoint: string, state: string): DocNode {
  return { ...node, styles: merged(node.styles as StoredStyles, declarations, breakpoint, state) as DocNode['styles'] };
}
// the document with the declarations merged into one class definition's styles (made when the project has none: a
// class a page's element wears)
function withClassStyles(document: DocumentJson, name: string, declarations: ReadonlyMap<string, string>, breakpoint: string, state: string): DocumentJson {
  const held = document.classes ?? [];
  const at = held.findIndex((one) => one.name === name);
  const classes =
    at < 0
      ? [...held, { name, styles: merged({}, declarations, breakpoint, state) }]
      : held.map((one, index) => (index === at ? { ...one, styles: merged(one.styles as StoredStyles, declarations, breakpoint, state) } : one));
  return { ...document, classes } as DocumentJson;
}

type StoredStyles = Record<string, Record<string, Record<string, string>>>;
function merged(styles: StoredStyles, declarations: ReadonlyMap<string, string>, breakpoint: string, state: string): StoredStyles {
  const byState = { ...(styles[breakpoint] ?? {}) };
  byState[state] = { ...(byState[state] ?? {}), ...Object.fromEntries(declarations) };
  return { ...styles, [breakpoint]: byState };
}
