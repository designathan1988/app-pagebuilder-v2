// The Layout Compiler (spec "Layout Compiler", "Inferência de estrutura", "Stable Compilation"): the intent becomes the
// smallest ordinary structure that preserves it — nested flex rows and columns where the space slices cleanly (a
// guillotine decomposition), a grid with named areas where it does not, never absolute positioning (an overlap the
// person asked for shares a grid cell). Among the structures that hold the intent, a cost function prefers the one
// that keeps the nodes the page already has, then fewer wrappers and fewer declarations, so moving a divider 10px never
// rebuilds half the page. The output is data: a tree of keyed nodes and their declarations by the manifest's property
// ids, which the host turns into document nodes through the document's own owners (host/materialize.ts).
import type { Axis, Dimension, LayoutIntent, LayoutValue, Region } from '../intent/model.ts';
import { childrenOf, preferenceKey } from '../intent/model.ts';
import { refuse } from '../intent/problems.ts';
import { bounds, end, length, precision } from '../geometry/geometry.ts';
import { HEIGHT, WIDTH, lengthKey } from '../geometry/keys.ts';
import { solve, resolveValue } from '../constraints/solve.ts';
import { validateIntent } from '../topology/topology.ts';
import { patterns } from '../intent/analysis.ts';
import { morphCss, morphSegmentId } from '../responsive/continuum.ts';

// Declarations by role while compiling (camelCase names of the manifest's properties: minWidth for min-width); written
// out by the manifest's own ids at the end.
type Declarations = Record<string, string>;
export type Css = Readonly<Record<string, string>>;

export type NodeRole = 'root' | 'region' | 'row' | 'column' | 'grid' | 'masonry';

export interface CompiledNode {
  // the region id, a wrapper's key (group:<sorted region ids>), or ROOT_KEY for the composed container itself
  readonly key: string;
  readonly region: string | null;
  // the region is an element of the page the layout places (it keeps its own tag and children)
  readonly content: boolean;
  readonly role: NodeRole;
  readonly tag: string | null;
  readonly name: string | null;
  readonly styles: Css;
  // the declarations of each responsive rule or morph segment, by its id (mapped to project breakpoints by the host)
  readonly responsive: Readonly<Record<string, Css>>;
  readonly children: readonly CompiledNode[];
  readonly provenance: readonly string[];
}

export interface Compilation {
  readonly root: CompiledNode;
  // the solved intent the structure was compiled from
  readonly intent: LayoutIntent;
  readonly cost: number;
  readonly strategy: 'flex' | 'grid' | 'flow';
  readonly fingerprint: string;
  // every threshold the compiled CSS names, for the host's breakpoint owner
  readonly breakpoints: readonly { readonly id: string; readonly maxWidth: number }[];
}

export interface CompilerPorts {
  // the track list owner (src/core/style/tracks.ts tracksToValue)
  readonly tracks: (tracks: readonly string[]) => string;
  // the manifest's property ids by role (adapters/properties.ts propertyVocabulary)
  readonly properties: Readonly<Record<string, string>>;
  // the CSS a layout variable is written as when the project has a design token of that name (var(--card-gap)); null
  // writes its value
  readonly variable?: (name: string) => string | null;
}

export interface CompileOptions {
  // the keys of the nodes the page holds now: a structure that keeps them costs less
  readonly previous?: ReadonlySet<string>;
}

export const ROOT_NODE = '$root';
export const groupKey = (ids: readonly string[]): string => `group:${[...ids].sort().join('+')}`;

const number = (n: number): string => String(Math.round(n * 10000) / 10000);
const px = (n: number): string => `${number(n)}px`;

// The share of each sibling that takes a share of its line: their drawn lengths over the smallest of them, so three
// equal columns grow 1 1 1 and a 300/900 split grows 1 3. A sibling of a fixed or hugging length takes no share and
// counts for nothing here (null), so "280px + Fill" gives the fluid one 1.
function shares(lengths: readonly (number | null)[]): number[] {
  const fluid = lengths.filter((l): l is number => l !== null && l > precision);
  const smallest = fluid.length === 0 ? 1 : Math.min(...fluid);
  return lengths.map((l) => (l === null ? 0 : Math.round((l / smallest) * 10000) / 10000));
}

const takesShare = (d: Dimension): boolean => d.mode === 'fluid' || d.mode === 'proportional';

// Siblings in the order of an axis, gathered in bands that do not overlap along it: each band is one slice.
function partitions(regions: readonly Region[], axis: Axis): Region[][] {
  const sorted = [...regions].sort((a, b) => a.box[axis] - b.box[axis] || a.id.localeCompare(b.id));
  const groups: Region[][] = [];
  let stop = -Infinity;
  for (const r of sorted) {
    if (r.box[axis] >= stop - precision) {
      groups.push([r]);
      stop = end(r.box, axis);
    } else {
      (groups[groups.length - 1] as Region[]).push(r);
      stop = Math.max(stop, end(r.box, axis));
    }
  }
  return groups;
}

// A slicing along an axis is valid only when every slice fills the whole span across it: a hole has to stay a grid cell.
function slicing(regions: readonly Region[], axis: Axis): Region[][] | null {
  const groups = partitions(regions, axis);
  if (groups.length < 2) return null;
  const outer = bounds(regions.map((r) => r.box));
  const across: Axis = axis === 'x' ? 'y' : 'x';
  const fills = groups.every((g) => {
    const b = bounds(g.map((r) => r.box));
    return Math.abs(b[across] - outer[across]) <= precision && Math.abs(length(b, across) - length(outer, across)) <= precision;
  });
  return fills ? groups : null;
}

// Whether empty space is enclosed by regions on every side (a donut): only a grid keeps such a hole.
function enclosedVoid(regions: readonly Region[]): boolean {
  const xs = [...new Set(regions.flatMap((r) => [r.box.x, end(r.box, 'x')]))].sort((a, b) => a - b);
  const ys = [...new Set(regions.flatMap((r) => [r.box.y, end(r.box, 'y')]))].sort((a, b) => a - b);
  const covered = (x: number, y: number) => regions.some((r) => r.box.x <= (xs[x] as number) && end(r.box, 'x') >= (xs[x + 1] as number) && r.box.y <= (ys[y] as number) && end(r.box, 'y') >= (ys[y + 1] as number));
  const empty = new Set<string>();
  for (let y = 0; y < ys.length - 1; y += 1) for (let x = 0; x < xs.length - 1; x += 1) if (!covered(x, y)) empty.add(`${x}:${y}`);
  // flood the empty cells that reach the outline: what is left is enclosed
  const queue = [...empty].filter((id) => {
    const [x, y] = id.split(':').map(Number) as [number, number];
    return x === 0 || y === 0 || x === xs.length - 2 || y === ys.length - 2;
  });
  for (const id of queue) empty.delete(id);
  for (let i = 0; i < queue.length; i += 1) {
    const [x, y] = (queue[i] as string).split(':').map(Number) as [number, number];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const id = `${x + dx}:${y + dy}`;
      if (empty.delete(id)) queue.push(id);
    }
  }
  return empty.size > 0;
}

function nodeCount(n: CompiledNode): number {
  return 1 + n.children.reduce((s, c) => s + nodeCount(c), 0);
}
function cssCount(n: CompiledNode): number {
  return Object.keys(n.styles).length + Object.values(n.responsive).reduce((s, css) => s + Object.keys(css).length, 0) + n.children.reduce((s, c) => s + cssCount(c), 0);
}
function keysOf(n: CompiledNode, into: Set<string> = new Set()): Set<string> {
  into.add(n.key);
  for (const c of n.children) keysOf(c, into);
  return into;
}

// The cost of a structure (spec "Stable Compilation"): every node the page does not hold yet, and every wrapper of these
// regions the page holds that the structure would drop, costs most; then each node (fewer wrappers), then each
// declaration (lower CSS complexity).
function cost(n: CompiledNode, previous: ReadonlySet<string> | undefined, held: readonly string[] = []): number {
  if (previous === undefined || previous.size === 0) return nodeCount(n) * 10 + cssCount(n);
  const keys = keysOf(n);
  const created = [...keys].filter((k) => !previous.has(k)).length;
  const members = new Set(held);
  const dropped = [...previous].filter((k) => k.startsWith('group:') && !keys.has(k) && k.slice('group:'.length).split('+').every((id) => members.has(id))).length;
  return (created + dropped) * 30 + nodeCount(n) * 10 + cssCount(n);
}

// A group laid in one line (a row or a column of single regions) is one-dimensional: flexbox's domain, so a grid there
// costs more (spec "Inferência de Flexbox": one predominant axis).
const ONE_DIMENSIONAL_GRID = 15;

export function compile(intent: LayoutIntent, ports: CompilerPorts, options: CompileOptions = {}): Compilation {
  const solution = solve(intent);
  const problems = [...solution.conflicts, ...validateIntent(solution.graph)];
  if (problems.length > 0) refuse('conflict', { constraint: problems.map((p) => (typeof p === 'string' ? p : p.code)).join(', ') });
  const graph = solution.graph;
  const value = (v: LayoutValue): string => (typeof v === 'string' ? (ports.variable?.(v) ?? px(resolveValue(graph, v))) : px(v));

  // the gap a group's children keep along an axis: one gap constraint over exactly them (a variable stays a variable),
  // else the drawn gaps when they are all the same
  const gapOf = (held: readonly Region[], axis: Axis, drawn: readonly number[]): string | null => {
    const ids = new Set(held.map((r) => r.id));
    const declared = graph.constraints.find((c) => c.kind === 'gap' && c.axis === axis && c.regions.length === ids.size && c.regions.every((id) => ids.has(id)));
    if (declared !== undefined && declared.kind === 'gap') return value(declared.value);
    const first = drawn[0] ?? 0;
    return drawn.every((g) => Math.abs(g - first) < precision) ? px(first) : null;
  };

  // the rule-by-rule declarations of a region itself: hidden, its place in the order, a size of its own
  const ownResponsive = (r: Region): Record<string, Declarations> => {
    const result: Record<string, Declarations> = {};
    for (const rule of graph.responsive) {
      const css: Declarations = {};
      const size = rule.sizes?.[r.id];
      const order = rule.order?.indexOf(r.id) ?? -1;
      if (rule.hidden.includes(r.id)) css.display = 'none';
      if (size?.width !== undefined) {
        css.flexBasis = px(size.width);
        css.flexGrow = '0';
        css[WIDTH] = px(size.width);
      }
      if (size?.mode === 'fill-available') {
        css.flexGrow = '1';
        css.flexBasis = '0%';
      }
      if (size?.mode === 'hug') css[WIDTH] = 'fit-content';
      if (order >= 0) css.order = String(order);
      if (Object.keys(css).length > 0) result[rule.id] = css;
    }
    return result;
  };

  // what a region declares about itself wherever it sits: the cross-axis size, minimum and maximum, its outline
  const ownStyles = (r: Region): Declarations => {
    const css: Declarations = {};
    if (r.kind !== 'content') {
      if (r.height.mode === 'fixed') css[HEIGHT] = px(r.box.height);
      else if (r.height.mode !== 'hug') css.minHeight = px(r.height.min ?? r.box.height);
    }
    if (r.height.min !== undefined && r.height.mode !== 'fixed') css.minHeight = px(r.height.min);
    if (r.height.max !== undefined) css.maxHeight = px(r.height.max);
    if (r.width.min !== undefined) css.minWidth = px(r.width.min);
    else css.minWidth = '0';
    if (r.width.max !== undefined) css.maxWidth = px(r.width.max);
    if (r.radius !== undefined) css.borderRadius = px(r.radius);
    if (r.layout?.padding !== undefined) css.padding = value(r.layout.padding);
    if (r.layout?.alignment !== undefined) css.alignItems = r.layout.alignment;
    if (r.layout?.distribution !== undefined) css.justifyContent = r.layout.distribution;
    if (r.polygon !== undefined) {
      const holes = r.holes ?? [];
      const head = r.polygon[0];
      // holes are traced into the outline and drawn with the even-odd rule, a cut-out in one clip-path
      const ring = holes.length > 0 && head !== undefined ? [...r.polygon, head, ...holes.flatMap((h) => (h[0] === undefined ? [] : [h[0], ...h.slice(1), h[0], head]))] : r.polygon;
      const percent = (p: { x: number; y: number }) => `${number(((p.x - r.box.x) / r.box.width) * 100)}% ${number(((p.y - r.box.y) / r.box.height) * 100)}%`;
      css.clipPath = `polygon(${holes.length > 0 ? 'evenodd, ' : ''}${ring.map(percent).join(', ')})`;
    }
    return css;
  };

  // how a child takes its length along its row or column (spec "Modos de sizing"); the shares of the fluid ones
  const flexSizing = (r: Region, axis: Axis, share: number): Declarations => {
    const d: Dimension = r[lengthKey(axis)];
    if (d.mode === 'fixed') return { flexGrow: '0', flexShrink: '0', flexBasis: px(length(r.box, axis)) };
    if (d.mode === 'hug') return { flexGrow: '0', flexShrink: '1', flexBasis: 'auto' };
    if (d.mode === 'fill-available') return { flexGrow: '1', flexShrink: '1', flexBasis: '0%' };
    return { flexGrow: number(d.weight ?? share), flexShrink: '1', flexBasis: '0%' };
  };

  // the declarations a group's container takes when one of the rules reflows it
  const reflow = (key: string, count: number, flexAxis: Axis | null): Record<string, Declarations> => {
    const result: Record<string, Declarations> = {};
    for (const rule of graph.responsive) {
      const change = key === preferenceKey(null) ? (rule.columns === undefined ? null : { columns: rule.columns, gap: rule.gap }) : (rule.groups?.[key] ?? null);
      const gap = change?.gap ?? (key === preferenceKey(null) ? rule.gap : undefined);
      if (change === null && gap === undefined) continue;
      const css: Declarations = {};
      if (change !== null && change.columns === 1) {
        css.display = 'flex';
        css.flexDirection = 'column';
      } else if (change !== null) {
        css.display = 'grid';
        css.gridTemplateColumns = ports.tracks(Array.from({ length: Math.min(change.columns, count) }, () => 'minmax(0, 1fr)'));
        css.gridTemplateRows = 'none';
        css.gridTemplateAreas = 'none';
      }
      if (gap !== undefined) css.gap = px(gap);
      else if (change !== null && flexAxis !== null) css.gap = '0px';
      result[rule.id] = css;
    }
    return result;
  };

  // a reflowed group's children drop their place in the drawing: no grid area, no share of a row
  const releaseChildren = (children: CompiledNode[], key: string): CompiledNode[] => {
    const rules = graph.responsive.filter((rule) => (key === preferenceKey(null) ? rule.columns !== undefined : rule.groups?.[key] !== undefined));
    if (rules.length === 0) return children;
    return children.map((child) => {
      const responsive: Record<string, Css> = { ...child.responsive };
      for (const rule of rules) responsive[rule.id] = { flexGrow: '0', flexShrink: '1', flexBasis: 'auto', [WIDTH]: 'auto', gridArea: 'auto', ...responsive[rule.id] };
      return { ...child, responsive };
    });
  };

  const merge = (a: Readonly<Record<string, Css>>, b: Readonly<Record<string, Css>>): Record<string, Css> => {
    const out: Record<string, Css> = { ...a };
    for (const [id, css] of Object.entries(b)) out[id] = { ...out[id], ...css };
    return out;
  };

  // A group of siblings laid out: the container's own declarations and its children. The container is the parent
  // region's node (or the composed container), so a group adds no wrapper of its own.
  interface Laid {
    readonly role: NodeRole;
    readonly styles: Declarations;
    readonly responsive: Record<string, Css>;
    readonly children: CompiledNode[];
  }

  const leaf = (r: Region): CompiledNode => {
    const inner = childrenOf(graph, r.id);
    const laid = inner.length > 0 ? group(inner, preferenceKey(r.id)) : null;
    return {
      key: r.id,
      region: r.id,
      content: r.kind === 'content',
      role: 'region',
      tag: r.kind === 'content' ? null : r.semantic,
      name: r.name,
      styles: { ...ownStyles(r), ...(laid?.styles ?? {}) },
      responsive: merge(ownResponsive(r), laid?.responsive ?? {}),
      children: laid?.children ?? [],
      provenance: r.provenance,
    };
  };

  // a slice of several regions inside a row or a column: a wrapper of its own, keyed by what it holds
  const wrapper = (held: readonly Region[]): CompiledNode => {
    const laid = group(held, groupKey(held.map((r) => r.id)));
    return { key: groupKey(held.map((r) => r.id)), region: null, content: false, role: laid.role, tag: 'div', name: null, styles: { minWidth: '0', ...laid.styles }, responsive: laid.responsive, children: laid.children, provenance: held.flatMap((r) => r.provenance) };
  };

  const flex = (held: readonly Region[], axis: Axis, slices: readonly Region[][], key: string): Laid => {
    const boxes = slices.map((g) => bounds(g.map((r) => r.box)));
    const gaps = boxes.slice(1).map((box, i) => box[axis] - end(boxes[i] as typeof box, axis));
    const gap = gapOf(held, axis, gaps);
    const fluid = slices.map((g, i) => (g.length > 1 || takesShare((g[0] as Region)[lengthKey(axis)]) ? length(boxes[i] as (typeof boxes)[number], axis) : null));
    const share = shares(fluid);
    const children = slices.map((g, i) => {
      const node = g.length === 1 ? leaf(g[0] as Region) : wrapper(g);
      const sizing = g.length === 1 ? flexSizing(g[0] as Region, axis, share[i] as number) : { flexGrow: number(share[i] as number), flexShrink: '1', flexBasis: '0%' };
      // unequal gaps: each slice keeps its own distance from the one before it
      const margin = gap === null && i > 0 ? { [axis === 'x' ? 'marginLeft' : 'marginTop']: px(gaps[i - 1] as number) } : {};
      return { ...node, styles: { ...node.styles, ...sizing, ...margin } };
    });
    return {
      role: axis === 'x' ? 'row' : 'column',
      styles: { display: 'flex', flexDirection: axis === 'x' ? 'row' : 'column', ...(gap === null ? {} : { gap }) },
      responsive: reflow(key, children.length, axis),
      children: releaseChildren(children, key),
    };
  };

  // The tracks of a grid along an axis: one between every two consecutive region edges. When the empty tracks only
  // ever separate occupied ones (occupied, empty, occupied, ...) and are all the same size, they are the grid's gap
  // rather than tracks of their own.
  const tracksAlong = (held: readonly Region[], axis: Axis): { tracks: { from: number; to: number }[]; gap: number | null } => {
    const stops = [...new Set(held.flatMap((r) => [r.box[axis], end(r.box, axis)]))].sort((a, b) => a - b);
    const tracks = stops.slice(1).map((to, i) => ({ from: stops[i] as number, to }));
    const occupied = tracks.map((t) => held.some((r) => r.box[axis] <= t.from + precision && end(r.box, axis) >= t.to - precision));
    const alternating = occupied.length >= 3 && occupied.every((o, i) => o === (i % 2 === 0));
    const gaps = tracks.filter((_, i) => occupied[i] === false).map((t) => t.to - t.from);
    const first = gaps[0];
    if (!alternating || first === undefined || gaps.some((g) => Math.abs(g - first) > precision)) return { tracks, gap: null };
    return { tracks: tracks.filter((_, i) => occupied[i] === true), gap: first };
  };

  const grid = (held: readonly Region[], key: string): Laid => {
    const columns = tracksAlong(held, 'x');
    const rows = tracksAlong(held, 'y');
    const lineOf = (tracks: readonly { from: number; to: number }[], at: number, starting: boolean): number => (starting ? tracks.findIndex((t) => Math.abs(t.from - at) <= precision) : tracks.findIndex((t) => Math.abs(t.to - at) <= precision) + 1);
    const overlapping = held.some((r) => r.overlap === true || r.polygon !== undefined);
    const areas = rows.tracks.map(() => columns.tracks.map(() => '.'));
    const named = (i: number) => `r${i + 1}`;
    const children = held.map((r, i) => {
      const x1 = lineOf(columns.tracks, r.box.x, true);
      const x2 = lineOf(columns.tracks, end(r.box, 'x'), false);
      const y1 = lineOf(rows.tracks, r.box.y, true);
      const y2 = lineOf(rows.tracks, end(r.box, 'y'), false);
      for (let y = y1; y < y2; y += 1) for (let x = x1; x < x2; x += 1) (areas[y] as string[])[x] = named(i);
      const node = leaf(r);
      return { ...node, styles: { ...node.styles, gridArea: overlapping ? `${y1 + 1} / ${x1 + 1} / ${y2 + 1} / ${x2 + 1}` : named(i) } };
    });
    // a column track: fixed where a fixed region spans exactly it, sized by content where hugging ones do, else a share
    // of the free space (with the minimum a region spanning exactly it asks for)
    const exactly = (t: { from: number; to: number }, axis: Axis) => held.filter((r) => Math.abs(r.box[axis] - t.from) <= precision && Math.abs(end(r.box, axis) - t.to) <= precision);
    const fixedTrack = (t: { from: number; to: number }) => exactly(t, 'x').some((r) => r.width.mode === 'fixed');
    const huggingTrack = (t: { from: number; to: number }) => exactly(t, 'x').length > 0 && exactly(t, 'x').every((r) => r.width.mode === 'hug');
    const share = shares(columns.tracks.map((t) => (fixedTrack(t) || huggingTrack(t) ? null : t.to - t.from)));
    const columnSizes = columns.tracks.map((t, i) => {
      const exact = exactly(t, 'x');
      if (fixedTrack(t)) return px(t.to - t.from);
      if (huggingTrack(t)) return 'auto';
      const min = exact.map((r) => r.width.min).find((m) => m !== undefined);
      return `minmax(${min === undefined ? '0' : px(min)}, ${number(share[i] as number)}fr)`;
    });
    // a row track is at least as tall as it was drawn and grows with its content, unless a fixed region fixes it
    const rowSizes = rows.tracks.map((t) => (exactly(t, 'y').some((r) => r.height.mode === 'fixed') ? px(t.to - t.from) : `minmax(${px(t.to - t.from)}, auto)`));
    const styles: Declarations = { display: 'grid', gridTemplateColumns: ports.tracks(columnSizes), gridTemplateRows: ports.tracks(rowSizes) };
    if (!overlapping) styles.gridTemplateAreas = areas.map((row) => `"${row.join(' ')}"`).join(' ');
    if (columns.gap !== null || rows.gap !== null) styles.gap = `${px(rows.gap ?? 0)} ${px(columns.gap ?? 0)}`;
    return { role: 'grid', styles, responsive: reflow(key, children.length, null), children: releaseChildren(children, key) };
  };

  // independent columns of different heights: a grid of equal columns, each a column of its own
  const masonry = (held: readonly Region[], key: string): Laid | null => {
    const columns = partitions(held, 'x');
    if (columns.length < 2 || columns.length >= held.length) return null;
    const boxes = columns.map((c) => bounds(c.map((r) => r.box)));
    const gap = (boxes[1] as (typeof boxes)[number]).x - end(boxes[0] as (typeof boxes)[number], 'x');
    const children = columns.map((c) => {
      if (c.length === 1) return leaf(c[0] as Region);
      const sorted = [...c].sort((a, b) => a.box.y - b.box.y);
      const laid = flex(sorted, 'y', sorted.map((r) => [r]), groupKey(sorted.map((r) => r.id)));
      return { key: groupKey(sorted.map((r) => r.id)), region: null, content: false, role: 'masonry' as const, tag: 'div', name: null, styles: { minWidth: '0', ...laid.styles }, responsive: laid.responsive, children: laid.children, provenance: sorted.flatMap((r) => r.provenance) };
    });
    return { role: 'grid', styles: { display: 'grid', gridTemplateColumns: ports.tracks(columns.map(() => 'minmax(0, 1fr)')), gap: px(gap), alignItems: 'start' }, responsive: reflow(key, children.length, null), children: releaseChildren(children, key) };
  };

  function group(held: readonly Region[], key: string): Laid {
    if (held.length === 1) {
      const only = leaf(held[0] as Region);
      return { role: 'column', styles: {}, responsive: reflow(key, 1, 'y'), children: [only] };
    }
    const parent = (held[0] as Region).parent;
    const preference = graph.preferences?.[preferenceKey(parent)] ?? 'auto';
    if (preference === 'grid') return grid(held, key);
    if (preference === 'masonry' || (preference === 'auto' && patterns({ ...graph, regions: [...held] }).some((p) => p.kind === 'masonry'))) {
      const laid = masonry(held, key);
      if (laid !== null) return laid;
    }
    const candidates: Laid[] = [];
    if (!held.some((r) => r.overlap === true) && !enclosedVoid(held))
      for (const axis of ['x', 'y'] as const) {
        const slices = slicing(held, axis);
        if (slices !== null) candidates.push(flex(held, axis, slices, key));
      }
    if (candidates.length === 0 || preference === 'auto' || preference === 'fixed' || preference === 'proportional') candidates.push(grid(held, key));
    const oneLine = (['x', 'y'] as const).some((axis) => slicing(held, axis)?.every((slice) => slice.length === 1) === true);
    const ids = held.map((r) => r.id);
    const scored = candidates.map((laid) => ({ laid, score: cost({ key, region: null, content: false, role: laid.role, tag: null, name: null, styles: laid.styles, responsive: laid.responsive, children: laid.children, provenance: [] }, options.previous, ids) + (laid.role === 'grid' && oneLine ? ONE_DIMENSIONAL_GRID : 0) }));
    // a flex preference keeps a slicing structure when one exists
    const preferred = preference === 'flex' ? scored.filter((s) => s.laid.role !== 'grid') : scored;
    const pool = preferred.length > 0 ? preferred : scored;
    return pool.sort((a, b) => a.score - b.score || a.laid.role.localeCompare(b.laid.role))[0]?.laid as Laid;
  }

  const write = (styles: Readonly<Record<string, string>>): Css =>
    Object.fromEntries(
      Object.entries(styles).map(([role, text]) => {
        const property = ports.properties[role];
        if (property === undefined) throw new Error(`The manifest has no property for the layout role ${role}`);
        return [property, text];
      }),
    );

  // the morphs of a node: the widest segment is its declaration, each narrower one a rule of its own
  const morphed = (node: CompiledNode, isRoot: boolean): { styles: Declarations; responsive: Record<string, Css> } => {
    const styles: Declarations = { ...node.styles };
    const responsive: Record<string, Css> = { ...node.responsive };
    for (const morph of graph.morphs ?? []) {
      if (!(morph.region === node.region || (morph.region === null && isRoot))) continue;
      const fixedInRow = node.styles.flexBasis !== undefined && node.styles.flexBasis.endsWith('px');
      const role = morph.property === WIDTH ? (fixedInRow ? 'flexBasis' : WIDTH) : morph.property === HEIGHT ? (node.styles[HEIGHT] !== undefined ? HEIGHT : 'minHeight') : morph.property;
      const points = morph.points;
      styles[role] = morphCss(points[points.length - 2] as (typeof points)[number], points[points.length - 1] as (typeof points)[number]);
      for (let i = 1; i < points.length - 1; i += 1) {
        const id = morphSegmentId(morph, (points[i] as (typeof points)[number]).width);
        responsive[id] = { ...responsive[id], [role]: morphCss(points[i - 1] as (typeof points)[number], points[i] as (typeof points)[number]) };
      }
    }
    return { styles, responsive };
  };

  const materialize = (node: CompiledNode, isRoot = false): CompiledNode => {
    const { styles, responsive } = morphed(node, isRoot);
    return { ...node, styles: write(styles), responsive: Object.fromEntries(Object.entries(responsive).map(([id, css]) => [id, write(css)])), children: node.children.map((child) => materialize(child)) };
  };

  const roots = childrenOf(graph, null);
  const laid: Laid = roots.length === 0 ? { role: 'root', styles: {}, responsive: {}, children: [] } : group(roots, preferenceKey(null));
  const root = materialize({ key: ROOT_NODE, region: null, content: false, role: 'root', tag: null, name: null, styles: laid.styles, responsive: laid.responsive, children: laid.children, provenance: [] }, true);
  const breakpoints = [...graph.responsive.map((r) => ({ id: r.id, maxWidth: r.maxWidth })), ...(graph.morphs ?? []).flatMap((m) => m.points.slice(1, -1).map((p) => ({ id: morphSegmentId(m, p.width), maxWidth: p.width })))];
  const display = laid.styles.display;
  return { root, intent: graph, cost: cost(root, options.previous), strategy: display === 'flex' ? 'flex' : display === 'grid' ? 'grid' : 'flow', fingerprint: JSON.stringify(root), breakpoints };
}

// Every key a compiled tree names, for the host to find the nodes it keeps.
export function compiledKeys(root: CompiledNode): Set<string> {
  return keysOf(root);
}
