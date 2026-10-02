// The meaning a layout plainly shows (spec layout-composer, "Semantic inference"). Composing the page, a band across
// the top is its header, a band across the bottom its footer, and between them the narrow column beside the content is
// an aside and the widest region the main content. In any layout, a row or a grid of three alike regions or more is a
// list of articles (cards), and a plain region holding nothing but them is a section. Only regions the person has
// neither named nor given a meaning are read (Region.chosen): what it inferred before is read again after every
// gesture, so a region cut in two or moved never keeps a meaning its place no longer shows, and a page never holds two
// of one. What it infers is written like any other meaning: the tag the region compiles to and the name the Layers show
// (and the classes the export gives).
import type { LayoutIntent, Region, Semantic } from './model.ts';
import { childrenOf, findRegion } from './model.ts';
import { patterns } from './analysis.ts';

// The words a meaning is named with (layout.template.part.<key>), the name a region takes by its number ("Region 3"),
// and the test of a name that is still a number.
export interface MeaningWords {
  readonly name: (key: string) => string;
  readonly numbered: (n: number) => string;
  readonly generic: (name: string) => boolean;
}

// how much of the drawing's width a band must cover to be the page's header or footer, and how tall it may be
const ACROSS = 0.8;
const BAND = 0.3;
// the widest a column may be, of its row, to read as an aside
const ASIDE = 0.35;
// the fewest alike regions that read as a list of cards
const CARDS = 3;

// the meanings it reads, each with the template part that names it in the person's language
type Meant = 'header' | 'footer' | 'aside' | 'main' | 'article' | 'section';
const [HEADER, FOOTER, ASIDE_TAG, MAIN, ARTICLE, SECTION] = 'header footer aside main article section'.split(' ') as [Meant, Meant, Meant, Meant, Meant, Meant];
// a meaning given once in a layout, by the part that names it; the cards are numbered, a section keeps its name
const ONCE = Object.fromEntries([[HEADER, HEADER], [FOOTER, FOOTER], [ASIDE_TAG, 'sidebar'], [MAIN, 'content']]) as Readonly<Record<string, string>>;
const ITEM = 'item';
const PLAIN: Semantic = 'div';

// The regions in rows: those that share some height stand in one row.
function rows(regions: readonly Region[]): Region[][] {
  const sorted = [...regions].sort((a, b) => a.box.y - b.box.y);
  const out: Region[][] = [];
  let bottom = -Infinity;
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && r.box.y < bottom) {
      last.push(r);
      bottom = Math.max(bottom, r.box.y + r.box.height);
    } else {
      out.push([r]);
      bottom = r.box.y + r.box.height;
    }
  }
  return out;
}

// The page's own reading of its top level: header, footer, main content, aside.
function pageMeanings(top: readonly Region[]): Map<string, Meant> {
  const meant = new Map<string, Meant>();
  if (top.length < 2) return meant;
  const left = Math.min(...top.map((r) => r.box.x));
  const span = Math.max(...top.map((r) => r.box.x + r.box.width)) - left;
  const height = Math.max(...top.map((r) => r.box.y + r.box.height)) - Math.min(...top.map((r) => r.box.y));
  const lines = rows(top);
  const band = (row: readonly Region[] | undefined): Region | null => (row !== undefined && row.length === 1 && (row[0] as Region).box.width >= span * ACROSS && (row[0] as Region).box.height <= height * BAND ? (row[0] as Region) : null);
  const header = band(lines[0]);
  const footer = lines.length > 1 ? band(lines[lines.length - 1]) : null;
  if (header !== null) meant.set(header.id, HEADER);
  if (footer !== null) meant.set(footer.id, FOOTER);
  let main = false;
  for (const row of lines) {
    if (row.some((r) => meant.has(r.id))) continue;
    const width = Math.max(...row.map((r) => r.box.x + r.box.width)) - Math.min(...row.map((r) => r.box.x));
    // the main content is the widest region, or the one that already is when it is still wide enough: a tie never
    // moves the meaning from one region to the other
    const wide = row.filter((r) => r.box.width >= width / 2);
    const widest = wide.find((r) => r.semantic === MAIN) ?? ([...row].sort((a, b) => b.box.width - a.box.width)[0] as Region);
    if (!main && widest.box.width >= width / 2) {
      meant.set(widest.id, MAIN);
      main = true;
      if (row.length > 1) for (const r of row) if (r.id !== widest.id && r.box.width <= width * ASIDE) meant.set(r.id, ASIDE_TAG);
    }
  }
  return meant;
}

export function inferMeaning(graph: LayoutIntent, words: MeaningWords, page: boolean): LayoutIntent {
  const parts = [...Object.values(ONCE), ITEM].map((key) => words.name(key));
  const meanings = new Set<string>([HEADER, FOOTER, ASIDE_TAG, MAIN, ARTICLE, SECTION]);
  // a region the layout may read: never one the person named or gave a meaning; its name a number or one this reading
  // gave (a part's name, alone or with a number), its tag a div or one this reading gave
  // (a copy made by the repeat handle or a cut adds its own number: "Item 1 2")
  const ownName = (name: string) => parts.some((p) => name === p || (name.startsWith(`${p} `) && /^\d+( \d+)*$/.test(name.slice(p.length + 1))));
  // a page's own meanings (header, footer, content, sidebar) are read only on the page's top level
  const onceNames = Object.values(ONCE).map((key) => words.name(key));
  const pageOnly = (r: Region) => r.semantic in ONCE || onceNames.some((p) => r.name === p || r.name.startsWith(`${p} `));
  const readable = (r: Region) => r.kind !== 'content' && r.chosen !== true && (r.semantic === PLAIN || meanings.has(r.semantic)) && (words.generic(r.name) || ownName(r.name)) && (!pageOnly(r) || (page && r.parent === null));
  const free = graph.regions.filter(readable);
  if (free.length === 0) return graph;
  const meant = page ? pageMeanings(childrenOf(graph, null)) : new Map<string, Meant>();
  // cards: a row or a grid of alike regions, numbered in reading order; their holder a section when it holds only them
  const items = new Map<string, number>();
  for (const p of patterns(graph)) {
    if ((p.kind !== 'repeated-row' && p.kind !== 'grid') || p.regions.length < CARDS) continue;
    const held = p.regions.map((id) => findRegion(graph, id) as Region);
    if (held.some((r) => meant.has(r.id) || items.has(r.id))) continue;
    [...held].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x).forEach((r, i) => {
      meant.set(r.id, ARTICLE);
      items.set(r.id, i + 1);
    });
    const holder = p.parent === null ? undefined : findRegion(graph, p.parent);
    if (holder !== undefined && !meant.has(holder.id) && childrenOf(graph, holder.id).length === held.length) meant.set(holder.id, SECTION);
  }
  // a meaning given once that a region the person chose already holds is never given a second time
  const held = new Set<string>(graph.regions.filter((r) => !readable(r)).map((r) => r.semantic));
  const given = new Set<string>();
  const next = new Map<string, Region>();
  for (const r of free) {
    const part = meant.get(r.id);
    const once = part === undefined ? undefined : ONCE[part];
    if (part !== undefined && once !== undefined && !held.has(part) && !given.has(part)) {
      given.add(part);
      next.set(r.id, { ...r, semantic: part as Semantic, name: words.name(once) });
    } else if (part === ARTICLE) {
      next.set(r.id, { ...r, semantic: part as Semantic, name: `${words.name(ITEM)} ${items.get(r.id) ?? 1}` });
    } else if (part === SECTION) {
      next.set(r.id, { ...r, semantic: part as Semantic });
    } else if (r.semantic !== PLAIN || !words.generic(r.name)) {
      // a meaning its place no longer shows: back to a plain region, named by its number
      next.set(r.id, { ...r, semantic: PLAIN, name: words.numbered(Number(r.id.slice(1))) });
    }
  }
  const changed = [...next.values()].some((r) => {
    const before = findRegion(graph, r.id) as Region;
    return before.semantic !== r.semantic || before.name !== r.name;
  });
  return changed ? { ...graph, regions: graph.regions.map((r) => next.get(r.id) ?? r) } : graph;
}
