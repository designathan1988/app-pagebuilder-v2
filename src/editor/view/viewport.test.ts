import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../store.ts';
import { activeBreakpoint, viewportWidth } from './breakpoints.ts';
import { zoomOf } from './camera.ts';

describe('continuous responsive viewport', () => {
  it('fits the actual preview width rather than its breakpoint reference', () => {
    const store = createEditorStore({ storage: { read: () => null, write: () => {} }, freeze: true });
    store.dispatch('view.setViewportWidth', { width: 600 });
    expect(zoomOf(store.getState().ui, 700)).toBe(1);
  });
  it('previews intermediate widths with the matching cascade without changing the document or history', () => {
    const store = createEditorStore({ storage: { read: () => null, write: () => {} }, freeze: true });
    const before = store.getState().document;
    for (const [width, breakpoint] of [[1440, 'desktop'], [1181, 'desktop'], [1180, 'laptop'], [1024, 'laptop'], [834, 'tablet'], [600, 'tablet'], [390, 'phone'], [320, 'phone']] as const) {
      expect(store.dispatch('view.setViewportWidth', { width }).status).toBe('done');
      expect(viewportWidth(store.getState().ui)).toBe(width);
      expect(activeBreakpoint(store.getState().ui).id).toBe(breakpoint);
      expect(store.getState().document).toBe(before);
    }
    store.dispatch('view.setBreakpoint', { breakpoint: 'tablet' });
    expect(viewportWidth(store.getState().ui)).toBe(834);
  });

  it('refuses invalid widths without moving the viewport', () => {
    const store = createEditorStore({ storage: { read: () => null, write: () => {} }, freeze: true });
    for (const width of [0, -1, 319, 7681, NaN, Infinity]) {
      expect(store.dispatch('view.setViewportWidth', { width }).status).toBe('refused');
      expect(viewportWidth(store.getState().ui)).toBe(1440);
    }
  });
});
