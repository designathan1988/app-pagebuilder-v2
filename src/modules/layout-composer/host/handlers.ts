// The Layout Composer's commands (manifest/commands/layout-composer.json; spec layout-composer). Each change of the
// layout is one command and one undo step: the stroke is read again here by the same reader the canvas previewed it
// with (gestures/recognize.ts readStroke), so what is committed is what the person saw; the new intent is compiled and
// written into the container at once (host/materialize.ts), so the page is always the ordinary structure the layout
// means — there is no separate "apply" that could leave the two apart.
import { message, registerHandler, registerPredicate, type HandlerContext, type Message, type Outcome } from '../../../core/commands/registry.ts';
import { locate, type DocNode, type NodeId } from '../../../core/document/model.ts';
import { firstLockRefusal } from '../../../core/nodes/flags.ts';
import { pageShown } from '../../../core/project/pages.ts';
import { tracksToValue } from '../../../core/style/tracks.ts';
import { nodeMaker } from '../../../core/structure/insert.ts';
import type { MessageId } from '../../../generated/ids.ts';
import { manifest, numberConstant } from '../../../manifest/runtime.ts';
import type { EditorUi } from '../../../editor/state.ts';
import { activeBreakpoint } from '../../../editor/view/breakpoints.ts';
import { propertyVocabulary } from '../adapters/properties.ts';
import { compile, type CompilerPorts } from '../compiler/compile.ts';
import { execute, type Naming, type Operation } from '../gestures/operations.ts';
import { handleOf, readStroke, type StrokeMode } from '../gestures/recognize.ts';
import { nextSelection, type SelectionMode } from '../gestures/structural.ts';
import { nextRegionId } from '../intent/ids.ts';
import { emptyIntent, findRegion, region as newRegion, type LayoutIntent, type Point, type Region } from '../intent/model.ts';
import { LayoutRefusal, problemKey, type LayoutProblem } from '../intent/problems.ts';
import { mapBreakpoints } from '../responsive/continuum.ts';
import { validateIntent } from '../topology/topology.ts';
import { materialize } from './materialize.ts';
import { NAMESPACE, markerOf, recordOf, withAuthoring, type ContainerRecord } from './record.ts';
import { composerOf, withComposer, type ComposerState } from './state.ts';

type Context = HandlerContext<EditorUi>;

// how near an edge or a handle a press counts as on it, in screen px (interactions.json layout.hitRadius)
const HIT_RADIUS = numberConstant('layout.hitRadius');
// the height an empty container is composed in (interactions.json layout.emptyHeight)
const EMPTY_HEIGHT = numberConstant('layout.emptyHeight');

const COMPILER: CompilerPorts = {
  tracks: tracksToValue,
  properties: propertyVocabulary([...manifest.properties.properties, ...manifest.properties.composites]),
};

// the element type new regions are made of: the container that can carry every meaning a region takes
const REGION_TYPE = 'div';

// A problem of the engine said through the catalogue (layout.problem.<code>), its values as they are.
const said = (problem: LayoutProblem): Message => message(problemKey(problem) as MessageId, problem.params);
const refusedWith = (problems: readonly LayoutProblem[]): Outcome<EditorUi> => ({ kind: 'refused', message: problems[0] === undefined ? message('layout.refused') : said(problems[0]) });

// Whether a container is being composed: the predicate of every command but layout.enter.
export const layoutComposing = registerPredicate<EditorUi>(
  'layoutComposing',
  (state) => composerOf(state.ui) !== null,
  () => message('layout.inactive'),
);

// New regions are named in the person's language: "Region 3", "Header 2" (a split's second part).
// The canvas previews a stroke with the same naming, through the editor's own words (interaction/tool.ts).
// A part of a region named by its number alone ("Region 2") is a region of its own number ("Region 3"), not "Region 2 2";
// a part of a region the person named keeps the name with the part's number ("Header 2").
export const namingWith = (words: (key: MessageId, params: Readonly<Record<string, number>>) => string): Naming => {
  const generic = (n: number) => words('layout.label.region' as MessageId, { n });
  const [before = '', after = ''] = generic(0).split('0');
  const numbered = (name: string) => name.startsWith(before) && name.endsWith(after) && /^\d+$/.test(name.slice(before.length, name.length - after.length));
  return { named: (base, n) => (base === null || numbered(base) ? generic(n) : `${base} ${n}`) };
};
const naming = (context: Context): Naming => namingWith(context.words);

// The container being composed, and its record.
function composed(context: Context): { readonly state: ComposerState; readonly container: DocNode; readonly path: readonly (string | number)[]; readonly record: ContainerRecord } {
  const state = composerOf(context.state.ui);
  if (state === null) throw new LayoutRefusal('container');
  const at = locate(context.state.document, state.target);
  if (at === null) throw new LayoutRefusal('container');
  const record = recordOf(at.node);
  if (record === null) throw new LayoutRefusal('container');
  return { state, container: at.node, path: at.path, record };
}

// The intent's changed graph written into the container: compiled and materialized in this one command.
function written(context: Context, graph: LayoutIntent, selection: readonly string[]): Outcome<EditorUi> {
  const { state, container, path, record } = composed(context);
  const keys = new Set<string>();
  const visit = (node: DocNode) => {
    for (const child of node.children) {
      const marker = markerOf(child);
      if (marker !== null) keys.add(marker.key);
      visit(child);
    }
  };
  visit(container);
  const compilation = compile(graph, COMPILER, { previous: keys });
  const breakpoints = mapBreakpoints(graph, manifest.properties.breakpoints.map((b) => ({ id: b.id, maxWidth: b.width, base: b.base })));
  const make = nodeMaker(context.state.document, context.rules, context.ids, context.words);
  const next = materialize(context, withAuthoring(container, { ...record, intent: graph }), compilation, { make, regionType: REGION_TYPE, breakpoints });
  const kept = selection.filter((id) => findRegion(graph, id) !== undefined);
  return {
    kind: 'change',
    patches: [{ op: 'replace', path: [...path], value: next }],
    ui: withComposer(context.state.ui, { ...state, selection: kept }),
    message: message('layout.status.changed'),
  };
}

// An operation of the gesture algebra on the composed intent, refused with the engine's own problem when it cannot be.
function operate(context: Context, operation: Operation, selection?: readonly string[]): Outcome<EditorUi> {
  const { state, record } = composed(context);
  const result = execute(record.intent, operation, naming(context));
  if (!result.ok) return refusedWith(result.problems);
  return written(context, result.graph, selection ?? state.selection);
}

// Runs a command body, turning a refusal of the engine (a LayoutRefusal) into the command's refusal: an invalid
// operation changes nothing and says why (spec "Error recovery").
function guarded(context: Context, body: () => Outcome<EditorUi>): Outcome<EditorUi> {
  try {
    const locked = composerOf(context.state.ui) === null ? null : firstLockRefusal(context.state.document, [composerOf(context.state.ui)?.target as NodeId], 'status.locked.edit');
    if (locked !== null) return { kind: 'refused', message: locked };
    return body();
  } catch (error) {
    if (error instanceof LayoutRefusal) return refusedWith([error.problem]);
    throw error;
  }
}

// The elements a container already holds, as the regions the layout places: each keeps its id, its styles and its
// children; it is measured where the canvas draws it, in the container's own coordinates, and marked so the composer
// finds it again (record.ts).
function adopt(context: Context, container: DocNode, graph: LayoutIntent): { readonly graph: LayoutIntent; readonly container: DocNode } {
  const origin = context.layout.box(container.id);
  if (origin === null) throw new LayoutRefusal('container');
  let next = graph;
  const children = container.children.map((child) => {
    if (markerOf(child) !== null) return child;
    const box = context.layout.box(child.id);
    if (box === null) return child;
    const id = nextRegionId(next);
    const placed: Region = { ...newRegion(id, { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height }, child.name), kind: 'content' };
    const tried = { ...next, regions: [...next.regions, placed] };
    // an element the layout cannot place as a region of its own (drawn with no width or height, or over another one)
    // stays where it is, unplaced: the structure keeps it after the regions (materialize.ts), never loses it
    if (validateIntent(tried).length > 0) return child;
    next = tried;
    return withAuthoring(child, { role: 'node', key: id, owns: {} });
  });
  return { graph: next, container: { ...container, children } };
}

// layout.enter: compose a container (the selected one, else the page's root). The first time, its elements become the
// regions the layout places, where they stand; afterwards it reopens with the intent it keeps, and elements added since
// join it as placed regions (spec "Reedição"). Nothing about the page's look changes until the first gesture.
export const enterLayout = registerHandler<'layout.enter', EditorUi>('layout.enter', (context, { target }) => {
  try {
    const id = target ?? context.state.selection[0] ?? pageShown(context.state)?.tree.id;
    const at = id === undefined ? null : locate(context.state.document, id);
    if (at === null || id === undefined || context.rules.elements.get(at.node.type)?.content !== 'children') return { kind: 'refused', message: message('layout.noContainer') };
    const locked = firstLockRefusal(context.state.document, [id], 'status.locked.edit');
    if (locked !== null) return { kind: 'refused', message: locked };
    const box = context.layout.box(id);
    if (box === null) return { kind: 'refused', message: message('layout.noContainer') };
    if (!(box.width > 0)) return refusedWith([{ code: 'viewport', params: {} }]);
    const held = recordOf(at.node);
    // the height composed in: the container's own, else room to draw — the screen's for the page's root, the empty
    // height for any other container (interactions.json layout.emptyHeight)
    const room = at.parent === null ? activeBreakpoint(context.state.ui).height : EMPTY_HEIGHT;
    const start: LayoutIntent = held?.intent ?? emptyIntent(box.width, Math.max(box.height, room));
    const adopted = adopt(context, at.node, start);
    const record: ContainerRecord = { role: 'container', version: 1, intent: adopted.graph, owns: held?.owns ?? {} };
    return {
      kind: 'change',
      patches: [{ op: 'replace', path: [...at.path], value: withAuthoring(adopted.container, record) }],
      ui: withComposer(context.state.ui, { target: id, selection: [], lens: 'spatial', tool: 'auto' }),
      message: message('layout.status.entered', { name: at.node.name }),
    };
  } catch (error) {
    if (error instanceof LayoutRefusal) return refusedWith([error.problem]);
    throw error;
  }
});

// layout.leave: the composer closes; the page keeps the structure it was compiled to, and the container its intent.
export const leaveLayout = registerHandler<'layout.leave', EditorUi>('layout.leave', ({ state }) => ({ kind: 'change', ui: withComposer(state.ui, null), message: message('layout.status.closed') }));

// The hit radius in the container's px: the screen radius over the zoom the person set (the fitted view: 1). The
// canvas previews a stroke with the same radius (interaction/tool.ts), so the preview and the command read it alike.
export const hitRadius = (ui: EditorUi): number => HIT_RADIUS / (ui.preferences.zoom === undefined ? 1 : ui.preferences.zoom / 100);

const isPoint = (p: unknown): p is Point => typeof p === 'object' && p !== null && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y);

// layout.stroke: one gesture on the canvas, in the container's coordinates, read by the one tool (or the tool chosen,
// or the key held): a new region, a split or a cut, a merge, a subtraction, a move, a nest, a boundary or handle drag,
// a marquee that selects, constraints painted, a lasso that groups.
export const strokeLayout = registerHandler<'layout.stroke', EditorUi>('layout.stroke', (context, { mode, points, handle }) =>
  guarded(context, () => {
    const { record, state } = composed(context);
    if (!Array.isArray(points) || !points.every(isPoint)) throw new Error('layout.stroke: a door hands the stroke as points');
    const reading = readStroke(record.intent, { points, mode: mode as StrokeMode, handle: handle === undefined ? null : handleOf(handle), radius: hitRadius(context.state.ui) }, naming(context));
    if (reading.selection !== null) return { kind: 'change', ui: withComposer(context.state.ui, { ...state, selection: reading.selection }) };
    if (reading.operation === null || reading.result === null) return refusedWith(reading.problems);
    if (!reading.result.ok) return refusedWith(reading.result.problems);
    const made = reading.result.affected.filter((id) => findRegion(record.intent, id) === undefined && findRegion(reading.result?.ok === true ? reading.result.graph : record.intent, id) !== undefined);
    return written(context, reading.result.graph, made.length > 0 ? made : state.selection);
  }),
);

// layout.select: the regions a click picks (replace, add, toggle, or the next one under the same point).
export const selectLayout = registerHandler<'layout.select', EditorUi>('layout.select', (context, { regions, mode }) =>
  guarded(context, () => {
    const { record, state } = composed(context);
    if (!Array.isArray(regions) || !regions.every((r) => typeof r === 'string' && findRegion(record.intent, r) !== undefined)) return refusedWith([{ code: 'unknown-region', params: {} }]);
    const selection = nextSelection(state.selection, regions as string[], mode as SelectionMode);
    const names = selection.map((id) => findRegion(record.intent, id)?.name ?? id).join(', ');
    return { kind: 'change', ui: withComposer(context.state.ui, { ...state, selection }), message: selection.length === 0 ? message('layout.status.noSelection') : message('layout.status.selected', { names }) };
  }),
);

// layout.delete: the selected regions go, with what they hold (spec "Delete"); undo brings them back.
export const deleteLayout = registerHandler<'layout.delete', EditorUi>('layout.delete', (context) =>
  guarded(context, () => {
    const { state } = composed(context);
    if (state.selection.length === 0) return refusedWith([{ code: 'nothing-selected', params: {} }]);
    return operate(context, { kind: 'delete', ids: state.selection }, []);
  }),
);

// layout.view: the lens the overlay draws and the tool the canvas uses.
export const viewLayout = registerHandler<'layout.view', EditorUi>('layout.view', (context, { lens, tool }) =>
  guarded(context, () => {
    const { state } = composed(context);
    const next = { ...state, ...(lens === undefined ? {} : { lens }), ...(tool === undefined ? {} : { tool: tool as StrokeMode }) };
    // what the canvas now draws and reads, in the person's words
    const said = tool !== undefined ? message('layout.status.tool', { tool: context.words(`layout.tool.${next.tool}` as MessageId) }) : message('layout.status.lens', { lens: context.words(`layout.lens.${next.lens}` as MessageId) });
    return { kind: 'change', ui: withComposer(context.state.ui, next), message: said };
  }),
);

export { NAMESPACE };
