// The Layout Composer through the editor's real store (spec layout-composer): entering a container, strokes as one
// undo step each, the compiled structure written as ordinary elements, refusals that change nothing.
import { describe, expect, it } from 'vitest';
import { locate, type DocNode, type NodeId } from '../../../core/document/model.ts';
import { anyCss } from '../../../core/ports/css.ts';
import { noLayout, type Layout } from '../../../core/ports/layout.ts';
import { manualClock } from '../../../core/ports/clock.ts';
import { sequentialIds } from '../../../core/ports/ids.ts';
import type { Rect } from '../../../generated/commands.ts';
import { createEditorStore, type EditorStore } from '../../../editor/store.ts';
import type { PreferenceStorage } from '../../../editor/preferences/preferences.ts';
import { markerOf, recordOf } from './record.ts';
import { composerOf } from './state.ts';

const memory = (): PreferenceStorage => ({ read: () => null, write: () => {} });
const PAGE: Rect = { x: 0, y: 0, width: 1440, height: 900 };

// A store whose canvas draws the page's root at 1440 × 900 and the boxes given for other nodes.
function composer(boxes: Readonly<Record<string, Rect>> = {}): { readonly store: EditorStore; readonly root: () => DocNode } {
  let rootId = '';
  const layout: Layout = { ...noLayout, box: (id: NodeId) => (id === rootId ? PAGE : (boxes[id] ?? null)) };
  const store = createEditorStore({ storage: memory(), ids: sequentialIds('n'), clock: manualClock(), ports: { layout, css: anyCss, readOnly: () => false }, freeze: true });
  const root = () => store.getState().document.pages[0]?.tree as DocNode;
  rootId = root().id;
  return { store, root };
}

const stroke = (store: EditorStore, points: readonly { x: number; y: number }[], mode = 'auto', handle?: string) => {
  const gesture = store.gesture();
  const result = gesture.dispatch('layout.stroke', { mode, points, ...(handle === undefined ? {} : { handle }) } as never);
  gesture.commit();
  return result;
};

describe('Layout Composer host (host/handlers.ts)', () => {
  it('enters the page root with nothing selected and keeps the record on it', () => {
    const { store, root } = composer();
    expect(store.dispatch('layout.enter', {})).toEqual({ status: 'done', changed: true });
    expect(composerOf(store.getState().ui)?.target).toBe(root().id);
    expect(recordOf(root())?.intent.viewport).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  });

  it('draws a region as an ordinary element, one undo step, and undo takes it away', () => {
    const { store, root } = composer();
    store.dispatch('layout.enter', {});
    const before = store.getState().history.past.length;
    expect(stroke(store, [{ x: 40, y: 40 }, { x: 700, y: 200 }, { x: 1400, y: 300 }]).status).toBe('done');
    expect(store.getState().history.past.length).toBe(before + 1);
    const children = root().children;
    expect(children).toHaveLength(1);
    expect(children[0]?.type).toBe('div');
    expect(markerOf(children[0] as DocNode)?.kind).toBe('structural');
    expect(recordOf(root())?.intent.regions).toHaveLength(1);
    // the declarations the layout writes are flex or grid, never absolute positioning
    const written = JSON.stringify(children[0]?.styles ?? {}) + JSON.stringify(root().styles);
    expect(written).not.toContain('absolute');
    store.dispatch('history.undo', {});
    expect(root().children).toHaveLength(0);
  });

  it('keeps an element the container held: it becomes a placed region with its id, and a stroke keeps it', () => {
    const boxes: Record<string, Rect> = {};
    const { store, root } = composer(boxes);
    expect(store.dispatch('element.insert', { entry: 'heading' } as never).status).toBe('done');
    const headingId = root().children[0]?.id ?? '';
    boxes[headingId] = { x: 40, y: 40, width: 600, height: 80 };
    store.dispatch('selection.clear', {} as never);
    store.dispatch('layout.enter', { target: root().id } as never);
    const placed = recordOf(root())?.intent.regions ?? [];
    expect(placed).toHaveLength(1);
    expect(placed[0]?.kind).toBe('content');
    expect(markerOf(root().children[0] as DocNode)?.key).toBe(placed[0]?.id);
    expect(stroke(store, [{ x: 40, y: 200 }, { x: 1400, y: 500 }]).status).toBe('done');
    const ids = root().children.map((c) => c.id);
    expect(ids).toContain(headingId);
  });

  it('writes the room drawn around the regions as the container padding, and names a cut part by a fresh number', () => {
    const { store, root } = composer();
    store.dispatch('layout.enter', {});
    stroke(store, [{ x: 40, y: 30 }, { x: 1400, y: 600 }]);
    const base = JSON.stringify(root().styles);
    expect(base).toContain('"padding-top":"30px"');
    expect(base).toContain('"padding-left":"40px"');
    expect(base).toContain('"padding-right":"40px"');
    stroke(store, [{ x: 500, y: 10 }, { x: 500, y: 300 }, { x: 500, y: 640 }]);
    // composing the page, the two columns are read as what they plainly are: the narrow one beside the content
    expect(recordOf(root())?.intent.regions.map((r) => [r.name, r.semantic]).sort()).toEqual([['Content', 'main'], ['Sidebar', 'aside']]);
  });

  it('cuts a region in two along a stroke across it', () => {
    const { store, root } = composer();
    store.dispatch('layout.enter', {});
    stroke(store, [{ x: 40, y: 40 }, { x: 1400, y: 600 }]);
    expect(stroke(store, [{ x: 500, y: 10 }, { x: 500, y: 300 }, { x: 500, y: 640 }]).status).toBe('done');
    expect(recordOf(root())?.intent.regions).toHaveLength(2);
    expect(root().children.length).toBeGreaterThan(0);
  });

  it('refuses a stroke that means nothing and changes nothing', () => {
    const { store, root } = composer();
    store.dispatch('layout.enter', {});
    const before = root();
    const result = stroke(store, [{ x: 10, y: 10 }]);
    expect(result.status).toBe('refused');
    expect(root()).toBe(before);
  });

  it('leaves: the page keeps its structure and the composer closes', () => {
    const { store, root } = composer();
    store.dispatch('layout.enter', {});
    stroke(store, [{ x: 40, y: 40 }, { x: 1400, y: 600 }]);
    store.dispatch('layout.leave', {});
    expect(composerOf(store.getState().ui)).toBeNull();
    expect(root().children).toHaveLength(1);
    expect(locate(store.getState().document, root().children[0]?.id as NodeId)).not.toBeNull();
  });
});

describe('Layout Composer properties and screen sizes (layout.configure, layout.interpret, layout.respond)', () => {
  const twoColumns = () => {
    const made = composer();
    made.store.dispatch('layout.enter', {});
    stroke(made.store, [{ x: 40, y: 40 }, { x: 1400, y: 400 }]);
    stroke(made.store, [{ x: 500, y: 20 }, { x: 500, y: 420 }]);
    return made;
  };
  const styles = (node: DocNode | undefined) => JSON.stringify(node?.styles ?? {});

  it('sets the meaning, the sizing and the inner space of the selected region, one undo step each', () => {
    const { store, root } = twoColumns();
    const steps = store.getState().history.past.length;
    expect(store.dispatch('layout.configure', { field: 'semantic', value: 'aside' } as never).status).toBe('done');
    expect(root().children.some((c) => c.tag === 'aside')).toBe(true);
    expect(store.dispatch('layout.configure', { field: 'padding', value: '24px' } as never).status).toBe('done');
    expect(root().children.some((c) => styles(c).includes('"padding-top":"24px"'))).toBe(true);
    expect(store.dispatch('layout.configure', { field: 'width', value: 'fill-available' } as never).status).toBe('done');
    expect(store.getState().history.past.length).toBe(steps + 3);
    expect(store.getState().message).toEqual({ key: 'layout.status.configured', params: { names: 'Content', property: 'width' } });
  });

  it('refuses a value the property does not take, and a meaning for an element of the page, changing nothing', () => {
    const { store, root } = twoColumns();
    const before = root();
    expect(store.dispatch('layout.configure', { field: 'semantic', value: 'banner' } as never).status).toBe('refused');
    expect(store.dispatch('layout.configure', { field: 'padding', value: 'wide' } as never).status).toBe('refused');
    expect(root()).toBe(before);
  });

  it('arranges the top level as a grid when asked', () => {
    const { store, root } = twoColumns();
    store.dispatch('layout.select', { regions: [], mode: 'replace' } as never);
    expect(store.dispatch('layout.interpret', { strategy: 'grid' } as never).status).toBe('done');
    expect(styles(root())).toContain('"display":"grid"');
  });

  it('changes nothing of the screen sizes at the base one, and stacks the group at the tablet', () => {
    const { store, root } = twoColumns();
    expect(store.dispatch('layout.respond', { edit: 'stack' } as never)).toEqual({ status: 'refused', message: { key: 'layout.respond.base', params: {} } });
    store.dispatch('view.setBreakpoint', { breakpoint: 'tablet' } as never);
    store.dispatch('layout.select', { regions: [], mode: 'replace' } as never);
    expect(store.dispatch('layout.respond', { edit: 'stack' } as never).status).toBe('done');
    expect(JSON.stringify((root().styles as Record<string, unknown>).tablet)).toContain('"flex-direction":"column"');
    // drawing belongs to the base screen size
    expect(stroke(store, [{ x: 40, y: 500 }, { x: 400, y: 700 }]).status).toBe('refused');
  });
});
