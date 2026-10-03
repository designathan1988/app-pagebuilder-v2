import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/tokens.css';
import './editor/shell/shell.css';
import './editor/shell/window.css';
import './editor/shell/primitives.css';
import './editor/shell/menus.css';
import './editor/shell/top-bar.css';
import './editor/shell/sidebar.css';
import './editor/shell/canvas.css';
import './editor/shell/inspector.css';
import './editor/shell/panels.css';
import './editor/shell/dock.css';
import './editor/shell/status-bar.css';
import './editor/shell/panel-editors.css';
import './editor/shell/canvas-editing.css';
import './editor/shell/window-overlays.css';
import sprite from './ui/icons.svg?raw';
import { App } from './editor/app.tsx';
import { currentWorkRevision, readSavedWork, readVersions, restoredWork, startAutosave } from './editor/persistence/autosave.ts';
import { claimEditing, isEditing } from './editor/persistence/tab-guard.ts';
import { startDrafts } from './editor/persistence/drafts.ts';
import { MODEL_RULES, createEditorStore } from './editor/store.ts';
import { installTestPort } from './editor/test-port.ts';
import { installErrorFeed } from './editor/errors.ts';
import { reportError } from './core/incidents.ts';

const container = document.getElementById('root');
if (!container) {
  throw new Error('The #root element is missing from index.html.');
}

// The icon sprite (src/ui/icons.svg, generated from the icons the manifest names), once in the page, so every
// <use href="#name"> finds its symbol.
const icons = document.createElement('div');
icons.hidden = true;
icons.innerHTML = sprite;
document.body.prepend(icons);

// the work kept from the last session (autosave-restore), restored before anything is drawn; then every change is
// written again
// the editing lock first: a tab that opens while another edits only reads (multi-tab-guard)
await claimEditing();
const saved = await readSavedWork();
const restored = restoredWork(saved, MODEL_RULES);
// saved work the reader refused: the recovery dialog offers the versions IndexedDB keeps (autosave-corruption-recovery)
const recovery = saved !== null && restored === null ? await readVersions() : null;
const store = createEditorStore({ restored, recovery });
startAutosave(store, saved, restored !== null, isEditing);
startDrafts(store, currentWorkRevision, isEditing);
// what the end-to-end tests read, in every build (src/editor/test-port.ts)
installTestPort(store);

// what the page throws, into the incident feed: the status bar draws the count, the test port carries the list
// (src/editor/errors.ts, the plan's T2)
installErrorFeed();
createRoot(container, {
  // a render error is an incident too: React would otherwise unmount silently
  onUncaughtError: (error: unknown) => reportError('React could not render', error instanceof Error ? (error.stack ?? error.message) : String(error)),
}).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
