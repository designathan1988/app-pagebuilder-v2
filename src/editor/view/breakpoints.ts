// The breakpoint the editor shows and edits (ARCHITECTURE.md, Command owners; spec breakpoints-switch,
// project-breakpoints): one of the project's breakpoints (core/document/breakpoints.ts: its own table, else the
// default of properties.json), a workspace preference restored after a reload, the base one while none is chosen or
// the chosen one is not the project's. The frame's tabs switch it (view.setBreakpoint); the page inside the frame takes
// its width, and style writes go to its layer (the store's `layer`, with the style state of style-state.ts). The tabs,
// the canvas's width and the export's media queries all read the one table.
import { message, registerHandler } from '../../core/commands/registry.ts';
import { baseBreakpointOf, breakpointAtWidth, breakpointById, breakpointWords, DEFAULT_BREAKPOINTS, MAX_BREAKPOINT_WIDTH, type ProjectBreakpoint, type Tabled } from '../../core/document/breakpoints.ts';
import type { EditorUi } from '../state.ts';

export type Breakpoint = ProjectBreakpoint;

// what the breakpoint shown is read from: the project's table and the editor's choice
export interface Shown {
  readonly document: Tabled;
  readonly ui: EditorUi;
}

// the default base (the width a page is fitted at before a project is open)
const DEFAULT_BASE = DEFAULT_BREAKPOINTS.find((b) => b.base) ?? DEFAULT_BREAKPOINTS[0];
if (DEFAULT_BASE === undefined) throw new Error('properties.json declares no breakpoint');
export const BASE_BREAKPOINT: Breakpoint = DEFAULT_BASE;

// the breakpoint the editor shows now
export const activeBreakpoint = (shown: Shown): Breakpoint => (shown.ui.preferences.breakpoint === undefined ? undefined : breakpointById(shown.document, shown.ui.preferences.breakpoint)) ?? baseBreakpointOf(shown.document);

export const viewportWidth = (shown: Shown): number => shown.ui.viewportWidth ?? activeBreakpoint(shown).width;

// the preferences with this breakpoint chosen (the base is no preference: it is what shows without one)
export function choosing(ui: EditorUi, chosen: Breakpoint): EditorUi['preferences'] {
  const { breakpoint: _was, ...rest } = ui.preferences;
  void _was;
  return chosen.base ? rest : { ...rest, breakpoint: chosen.id };
}

export const setViewportWidth = registerHandler<'view.setViewportWidth', EditorUi>('view.setViewportWidth', ({ state }, { width }) => {
  if (!Number.isFinite(width) || width < 320 || width > MAX_BREAKPOINT_WIDTH) return { kind: 'refused', message: message('status.viewport.invalid') };
  const rounded = Math.round(width);
  const chosen = breakpointAtWidth(state.document, rounded);
  return { kind: 'change', ui: { ...state.ui, viewportWidth: rounded, preferences: choosing(state.ui, chosen) }, message: message('status.viewport.set', { width: rounded, breakpoint: breakpointWords(chosen) }) };
});

// a stored breakpoint: an id (whether the open project has it is read when it is shown); undefined otherwise (the base)
export const readBreakpoint = (stored: unknown): string | undefined => (typeof stored === 'string' && stored !== BASE_BREAKPOINT.id && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(stored) ? stored : undefined);

export const setBreakpoint = registerHandler<'view.setBreakpoint', EditorUi>(
  'view.setBreakpoint',
  ({ state }, { breakpoint }) => {
    const chosen = breakpointById(state.document, breakpoint);
    if (chosen === undefined) return { kind: 'refused', message: message('status.breakpoints.unknown') };
    // in the preview nothing is edited: the bar says which screen the page is shown on (the dogfooding pass)
    const said = state.ui.preview !== undefined ? 'status.breakpointPreviewed' : 'status.breakpointActive';
    const { viewportWidth: _width, ...ui } = state.ui;
    void _width;
    return { kind: 'change', ui: { ...ui, preferences: choosing(state.ui, chosen) }, message: message(said, { breakpoint: breakpointWords(chosen) }) };
  },
  // a tab stands for its breakpoint being the one shown
  (state, args) => activeBreakpoint(state).id === args.breakpoint,
);
