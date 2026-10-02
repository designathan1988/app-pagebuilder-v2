// The meaning a page's layout plainly shows (spec layout-composer, "Semantic inference"): a band across the top is
// its header, a band across the bottom its footer, and between them the narrow column beside the content is an aside
// and the widest region the main content. Only the page's own top level is read, and only regions the person has
// neither named nor given a meaning (Region.chosen): what it inferred before is read again after every gesture, so a
// region cut in two or moved never keeps a meaning its place no longer shows, and a page never holds two of one. What
// it infers is written like any other meaning: the tag the region compiles to and the name the Layers show (and the
// classes the export gives).
import type { LayoutIntent, Region, Semantic } from './model.ts';
import { childrenOf } from './model.ts';

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

// the meanings it reads, each with the template part that names it in the person's language
type Meant = 'header' | 'footer' | 'aside' | 'main';
const [HEADER, FOOTER, ASIDE_TAG, MAIN] = 'header footer aside main'.split(' ') as [Meant, Meant, Meant, Meant];
const PARTS = Object.fromEntries([[HEADER, HEADER], [FOOTER, FOOTER], [ASIDE_TAG, 'sidebar'], [MAIN, 'content']]) as Readonly<Record<Meant, string>>;
const PLAIN: Semantic = 'div';

// The top-level regions in rows: those that share some height stand in one row.
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

export function inferMeaning(graph: LayoutIntent, words: MeaningWords): LayoutIntent {
  const top = childrenOf(graph, null);
  const parts = Object.values(PARTS).map((key) => words.name(key));
  const meanings = new Set<string>(Object.keys(PARTS));
  // a region the layout may read: never one the person named or gave a meaning; its name a number or one this reading
  // gave (a part's name, alone or with the number a cut added), its tag a div or one this reading gave
  const ownName = (name: string) => parts.some((p) => name === p || (name.startsWith(`${p} `) && /^\d+$/.test(name.slice(p.length + 1))));
  const readable = (r: Region) => r.kind !== 'content' && r.chosen !== true && (r.semantic === PLAIN || meanings.has(r.semantic)) && (words.generic(r.name) || ownName(r.name));
  const free = top.filter(readable);
  if (free.length === 0) return graph;
  const meant = new Map<string, Meant>();
  if (top.length >= 2) {
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
  }
  // a meaning a region the person chose already holds is never given a second time, and each one once
  const held = new Set<string>(top.filter((r) => !readable(r)).map((r) => r.semantic));
  const given = new Set<string>();
  const next = new Map<string, Region>();
  for (const r of free) {
    const part = meant.get(r.id);
    if (part !== undefined && !held.has(part) && !given.has(part)) {
      given.add(part);
      next.set(r.id, { ...r, semantic: part as Semantic, name: words.name(PARTS[part]) });
    } else if (r.semantic !== PLAIN || !words.generic(r.name)) {
      // a meaning its place no longer shows: back to a plain region, named by its number
      next.set(r.id, { ...r, semantic: PLAIN, name: words.numbered(Number(r.id.slice(1))) });
    }
  }
  const changed = [...next.values()].some((r) => {
    const before = top.find((one) => one.id === r.id) as Region;
    return before.semantic !== r.semantic || before.name !== r.name;
  });
  return changed ? { ...graph, regions: graph.regions.map((r) => next.get(r.id) ?? r) } : graph;
}
