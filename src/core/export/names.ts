// The export's names (spec export-bem-css; DEC-07: class names in the project's code language, English unless the
// project says otherwise). An element's class says its role, never the words a name happens to be in:
//  - a name the vocabulary knows (roles.json: Título, Heading → title) takes its role;
//  - a name the editor gave (an element's, a template's or one of its parts': the person's interface language wrote it,
//    Sanfona, Barra de navegação, Coluna) takes the editor's own name for it in the code language (accordion,
//    navigation-bar, column), read from the catalogues;
//  - a name the person typed is kept when the project's language is the code language (Pricing Pro → pricing-pro);
//  - anything else says what the element is: a div by its layout (grid, row, column, container), another element by
//    its type (the audit's AUD-14: barra-de-navegacao, hero__coluna, section__sanfona in an English export).
// A second look of a name already taken takes a BEM modifier that says how it looks beside the first one (dark, large,
// raised…), never a number (the audit's AUD-14: section-2, section__card-3); only when every modifier is taken does
// one end in a number (alt-2).
import en from '../../i18n/locales/en.json' with { type: 'json' };
import ptBR from '../../i18n/locales/pt-BR.json' with { type: 'json' };
import type { ModelRules } from '../document/validate.ts';
import type { TemplateNode } from '../../manifest/schema.ts';
import { parseSrgb, toOklab } from '../style/color.ts';
import { slug } from '../text/fold.ts';
import roles from './roles.json' with { type: 'json' };

type Vocabulary = Readonly<Record<string, readonly string[]>>;
type Catalogue = Readonly<Record<string, string>>;
export type Declarations = Readonly<Record<string, string>>;

// the interface languages the editor names things in, each a catalogue
const CATALOGUES: readonly Catalogue[] = [en, ptBR];
const portuguese = (language: string): boolean => language.toLowerCase().startsWith('pt');
const primary = (language: string): string => language.toLowerCase().split('-')[0] ?? '';
// a name without the number a second element of the same name was given ("Título 3" is a Título)
const bare = (name: string): string => slug(name.replace(/\s+\d+$/, ''));
// a word a class can be made of: something, and not starting with a digit
const usable = (word: string): string | null => (word === '' || /^\d/.test(word) ? null : word);
// a catalogue's text in the code language
const textOf = (key: string, code: string): string => ((portuguese(code) ? ptBR : en) as Catalogue)[key] ?? '';

// the role a name stands for in the vocabulary, as the code language says it; null for a name it does not know
function vocabularyRole(name: string, code: string): string | null {
  const vocabulary: Vocabulary = portuguese(code) ? roles.pt : roles.en;
  const normalized = bare(name);
  if (normalized === '') return null;
  return Object.entries(vocabulary).find(([, aliases]) => aliases.some((alias) => slug(alias) === normalized))?.[0] ?? null;
}

// A name as a class word without the project around it: the vocabulary's role, else the name itself, else the tag.
export function semanticName(name: string, tag: string, language: string): string {
  return vocabularyRole(name, language) ?? usable(slug(name)) ?? tag.toLowerCase();
}

// What the names of one export are read against.
export interface Naming {
  readonly code: string;
  // the project's language is the code language: a name the person typed is a word of it, and kept
  readonly typedInCode: boolean;
  // the names the editor gives (every interface language's text, by its slug): the catalogue key each is
  readonly defaults: ReadonlyMap<string, string>;
  // each element type's label key (elements.json)
  readonly labels: ReadonlyMap<string, string>;
}

// The naming of a project: its languages, and the names the editor gives (every element type's label, every palette
// entry's, every name a template gives one of its parts, the wrappers' and layouts' names).
export function namingFor(projectLanguage: string | undefined, code: string, rules: Pick<ModelRules, 'elements' | 'palette'>): Naming {
  const labels = new Map([...rules.elements].map(([type, element]) => [type, element.labelKey as string]));
  const nameKeys = new Set<string>([...labels.values(), ...Object.values(roles.layout)]);
  const visit = (node: TemplateNode | null): void => {
    if (node === null) return;
    if (node.nameKey !== undefined) nameKeys.add(node.nameKey);
    for (const child of node.children ?? []) visit(child);
  };
  for (const entry of rules.palette.values()) {
    nameKeys.add(entry.labelKey);
    visit(entry.template);
  }
  const defaults = new Map<string, string>();
  for (const key of nameKeys) {
    for (const catalogue of CATALOGUES) {
      const said = slug(catalogue[key] ?? '');
      if (said !== '' && !defaults.has(said)) defaults.set(said, key);
    }
  }
  // a project that never said its language keeps the names it was given (the export before DEC-07's project language)
  const typedInCode = projectLanguage === undefined || primary(projectLanguage) === primary(code);
  return { code, typedInCode, defaults, labels };
}

// an element as its name is read: its name, type, tag and its declarations at the base breakpoint and state
export interface Named {
  readonly name: string;
  readonly type: string;
  readonly tag: string | null;
  readonly declarations: Declarations;
}

type Layout = keyof typeof roles.layout;
// how a div lays out what it holds, read from its own declarations
function layoutOf(declarations: Declarations): Layout {
  const [displayProperty = '', directionProperty = ''] = roles.layoutProperties;
  const display = declarations[displayProperty] ?? '';
  if (roles.layoutValues.grid.includes(display)) return 'grid';
  if (roles.layoutValues.flex.includes(display)) return roles.layoutValues.column.includes(declarations[directionProperty] ?? '') ? 'column' : 'row';
  return 'block';
}

// what an element is, as the code language says it: a div by its layout, another element by its type's own name
function typeRole(node: Named, naming: Naming): string {
  const key = roles.layoutTypes.includes(node.type) ? roles.layout[layoutOf(node.declarations)] : naming.labels.get(node.type);
  const text = key === undefined ? '' : textOf(key, naming.code);
  return vocabularyRole(text, naming.code) ?? usable(slug(text)) ?? (node.tag ?? node.type).toLowerCase();
}

// The word an element's class is made of (see the top of this file).
export function roleWord(node: Named, naming: Naming): string {
  const known = vocabularyRole(node.name, naming.code);
  if (known !== null) return known;
  const key = naming.defaults.get(bare(node.name));
  if (key !== undefined) {
    const text = textOf(key, naming.code);
    const word = vocabularyRole(text, naming.code) ?? usable(slug(text));
    if (word !== null) return word;
  }
  const typed = naming.typedInCode ? usable(slug(node.name)) : null;
  return typed ?? typeRole(node, naming);
}

// ---------------------------------------------------------------- a second look of a name

// an element's look beside another one's: its tag and its declarations at the base breakpoint and state
export interface Look {
  readonly tag: string | null;
  readonly declarations: Declarations;
}

type Modifier = (typeof roles.modifiers)[number];
const NONE = new Set(['', 'none', '0', '0px']);
const present = (value: string | undefined): boolean => value !== undefined && !NONE.has(value.trim());
// a length or a weight as a number to compare (px, rem and em at 16 px, a bare number, the two weight keywords)
const WEIGHTS: Readonly<Record<string, number>> = { normal: 400, bold: 700 };
function amount(value: string | undefined): number | null {
  if (value === undefined) return 0;
  const weight = WEIGHTS[value.trim()];
  if (weight !== undefined) return weight;
  const read = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(value.trim());
  if (read === null) return null;
  const number = Number(read[1]);
  return read[2] === 'rem' || read[2] === 'em' ? number * 16 : number;
}
// how light a colour is (Oklab's L, 0 to 1), or null for one the reader cannot read (a variable, a gradient)
function lightness(value: string): number | null {
  const colour = parseSrgb(value);
  return colour === null ? null : toOklab(colour).l;
}

// the word one rule says of a variant beside the first look, or null when the rule says nothing of them
function modifierWord(rule: Modifier, variant: Look, first: Look | null, code: string): string | null {
  const said = (words: unknown, which: string): string | null => {
    const table = (words ?? {}) as Readonly<Record<string, string>>;
    return usable(table[which] ?? '');
  };
  const words = 'en' in rule ? (portuguese(code) ? rule.pt : rule.en) : undefined;
  const properties = 'properties' in rule ? rule.properties : [];
  const own = (property: string): string | undefined => variant.declarations[property];
  const theirs = (property: string): string | undefined => first?.declarations[property];
  switch (rule.kind) {
    case 'tag': {
      // a heading of another level (title--h3): the tags the rule lists
      const tags: readonly string[] = 'tags' in rule ? rule.tags : [];
      return first !== null && variant.tag !== null && variant.tag !== first.tag && tags.includes(variant.tag) ? usable(variant.tag) : null;
    }
    case 'lightness': {
      const property = properties[0] ?? '';
      const value = own(property);
      if (value === undefined || value === theirs(property)) return null;
      const light = lightness(value);
      return said(words, light === null ? 'other' : light < 0.45 ? 'dark' : light > 0.9 ? 'light' : 'other');
    }
    case 'presence': {
      const mine = properties.some((property) => present(own(property)));
      const other = first !== null && properties.some((property) => present(theirs(property)));
      if (mine === other || (first === null && !mine)) return null;
      return said(words, mine ? 'present' : 'absent');
    }
    case 'size': {
      if (first === null || properties.every((property) => own(property) === theirs(property))) return null;
      const sum = (read: (property: string) => string | undefined): number | null =>
        properties.reduce<number | null>((total, property) => {
          const one = amount(read(property));
          return total === null || one === null ? null : total + one;
        }, 0);
      const mine = sum(own);
      const other = sum(theirs);
      if (mine === null || other === null || mine === other) return null;
      return said(words, mine > other ? 'more' : 'less');
    }
    case 'layout': {
      const mine = layoutOf(variant.declarations);
      if (mine === (first === null ? 'block' : layoutOf(first.declarations))) return null;
      return usable(slug(textOf(roles.layout[mine], code)));
    }
    case 'fallback':
      return typeof words === 'string' ? usable(words) : null;
  }
  return null;
}

// The modifier a variant takes: the first word the rules say of it that `free` accepts (a modifier no other look has);
// once every word is taken, the last word said numbered (alt-2).
export function variantModifier(variant: Look, first: Look | null, code: string, free: (word: string) => boolean): string {
  let last = 'alt';
  for (const rule of roles.modifiers) {
    const word = modifierWord(rule, variant, first, code);
    if (word === null) continue;
    if (free(word)) return word;
    last = word;
  }
  for (let index = 2; ; index += 1) if (free(`${last}-${index}`)) return `${last}-${index}`;
}

// The last resort, once every modifier is taken: the next free number (alt-2), stable from one export to the next,
// since elements with the same look reuse the first name (export.ts).
export function stableClass(base: string, _identity: string, _page: string, taken: ReadonlySet<string>): string {
  let name = base;
  for (let index = 2; taken.has(name); index += 1) name = `${base}-${index}`;
  return name;
}

export function batchNames(names: readonly string[], pattern: string, start = 1): readonly string[] {
  if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(start + names.length)) throw new Error('Invalid starting index');
  const output = names.map((name, index) => pattern.replaceAll('{name}', name).replaceAll('{n}', String(start + index)).trim());
  if (output.some((name) => name === '')) throw new Error('Every layer must have a nonempty name');
  return output;
}

export function pageLanguage(own: unknown, project: unknown): string {
  return typeof own === 'string' && own.trim() !== '' ? own : typeof project === 'string' && project.trim() !== '' ? project : 'en';
}

export function buttonKind(own: unknown, inForm: boolean, associated: boolean): string {
  return typeof own === 'string' && ['button', 'submit', 'reset'].includes(own) ? own : inForm || associated ? 'submit' : 'button';
}
