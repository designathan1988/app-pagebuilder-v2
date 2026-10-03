// @vitest-environment happy-dom
// One region that cannot draw leaves the others drawn (the audit's AUD-01: a status-bar text that threw while it was
// drawn unmounted the whole editor, a blank window). The boundary says why the region is empty, records an incident,
// and draws the region again at the next change of the store.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createEditorStore, StoreContext, useEditorState } from '../store.ts';
import { manualClock } from '../../core/ports/clock.ts';
import { sequentialIds } from '../../core/ports/ids.ts';
import { clearIncidents, incidents } from '../../core/incidents.ts';
import { RegionBoundary } from './region-boundary.tsx';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// a region that throws while the selection is empty, as the status bar threw on a text it could not format
function Fragile() {
  const selected = useEditorState((s) => s.selection.length);
  if (selected === 0) throw new Error('planted: this region cannot draw');
  return <p className="fragile" />;
}

afterEach(() => {
  vi.restoreAllMocks();
  clearIncidents();
});

describe('a region behind its error boundary', () => {
  it('fails alone: the other regions stay drawn, the incident is recorded, and the next change draws it again', () => {
    // React reports a caught error on the console as well; the incident feed is what this test reads
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    clearIncidents();
    const store = createEditorStore({ storage: { read: () => null, write: () => undefined }, ids: sequentialIds('n'), clock: manualClock() });
    const host = document.createElement('div');
    document.body.append(host);
    act(() => {
      createRoot(host).render(
        <StoreContext.Provider value={store}>
          <RegionBoundary region="status-bar">
            <Fragile />
          </RegionBoundary>
          <RegionBoundary region="inspector">
            <p className="steady" />
          </RegionBoundary>
        </StoreContext.Provider>,
      );
    });
    expect(host.querySelector('.steady')).not.toBeNull();
    const fallback = host.querySelector('.region-fallback--status-bar');
    expect(fallback?.getAttribute('role')).toBe('alert');
    expect(fallback?.textContent).toBe('This part of the editor could not be drawn. It is drawn again at the next change; the details are in Incidents.');
    expect(incidents().map((i) => i.what)).toContain('the status-bar region could not draw');
    expect(incidents().find((i) => i.what === 'the status-bar region could not draw')?.detail).toContain('planted: this region cannot draw');

    // a change that makes it drawable: the region is drawn again
    const root = store.getState().document.pages[0]?.tree.id;
    if (root === undefined) throw new Error('no page');
    act(() => {
      store.dispatch('selection.select', { target: root });
    });
    expect(host.querySelector('.region-fallback')).toBeNull();
    expect(host.querySelector('.fragile')).not.toBeNull();
    expect(host.querySelector('.steady')).not.toBeNull();
  });
});
