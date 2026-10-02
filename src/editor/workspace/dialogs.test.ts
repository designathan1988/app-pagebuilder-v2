// The batch rename's dialog opens only on a selection the batch can rename (spec batch-rename): the context menu, which
// offers only what applies (door.tsx appliesNow: the store's canRun), offered it on the page alone, where its dialog
// could only refuse (the overlay-lifecycle test's press "outside" the menu landed on it).
import { describe, expect, it } from 'vitest';
import { manualClock } from '../../core/ports/clock.ts';
import { sequentialIds } from '../../core/ports/ids.ts';
import type { PreferenceStorage } from '../preferences/preferences.ts';
import { createEditorStore } from '../store.ts';

const memory = (): PreferenceStorage => ({ read: () => null, write: () => undefined });
const store = () => createEditorStore({ storage: memory(), ids: sequentialIds('n'), clock: manualClock() });
const BATCH = { dialog: 'batch-rename' } as const;

describe('the batch rename dialog (workspace/dialogs.ts)', () => {
  it('opens on elements the batch can rename', () => {
    const s = store();
    const root = s.getState().document.pages[0]?.tree.id ?? '';
    s.dispatch('element.insert', { entry: 'container', parent: root });
    s.dispatch('element.insert', { entry: 'container', parent: root });
    const [first, second] = s.getState().document.pages[0]?.tree.children ?? [];
    s.dispatch('selection.select', { target: first?.id ?? '' });
    s.dispatch('selection.toggle', { target: second?.id ?? '' });
    expect(s.canRun('workspace.openDialog', BATCH)).toBe(true);
    s.dispatch('workspace.openDialog', BATCH);
    expect(s.getState().ui.dialog).toBe('batch-rename');
  });

  it('does not open on the page root, nor with nothing selected', () => {
    const s = store();
    expect(s.canRun('workspace.openDialog', BATCH)).toBe(false);
    s.dispatch('selection.select', { target: s.getState().document.pages[0]?.tree.id ?? '' });
    expect(s.canRun('workspace.openDialog', BATCH)).toBe(false);
    // the other dialogs open whatever is selected
    expect(s.canRun('workspace.openDialog', { dialog: 'guides-grids' })).toBe(true);
  });
});
