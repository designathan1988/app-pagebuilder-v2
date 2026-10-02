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
    expect(recordOf(root())?.intent.regions.map((r) => r.name).sort()).toEqual(['Region 1', 'Region 2']);
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
