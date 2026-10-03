// A narrow window (the plan's stage 5, jornada03 J25 and H17: at 1280 x 720 the canvas had 41 % of the window): below
// the manifest's width (interactions.json workspace.narrowWindow) the sidebar leaves its column and opens over the
// canvas, as Webflow's navigator does on a small window and Figma's panels minimise, and a press outside it or the
// focus leaving it for the canvas closes it (shell/sidebar.tsx). Whether the window is narrow is the window's, not the
// document's nor the editor state's: read from the browser, as the canvas's fit is.
import { createContext, useContext, useSyncExternalStore } from 'react';
import { manifest } from '../../manifest/runtime.ts';

const width = manifest.interactions.constants.find((c) => c.id === 'workspace.narrowWindow')?.value;
if (typeof width !== 'number') throw new Error('interactions.json has no number workspace.narrowWindow');
const QUERY = `(max-width: ${width - 1}px)`;

// whether the window is narrow now (outside a browser: never)
export function windowIsNarrow(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

const subscribe = (changed: () => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', changed);
  return () => list.removeEventListener('change', changed);
};

// whether the window is narrow, drawn again when it crosses the width
export function useWindowNarrow(): boolean {
  return useSyncExternalStore(subscribe, windowIsNarrow, () => false);
}

// the shell's answer, for the regions it holds
export const NarrowWindow = createContext(false);
export const useNarrowWindow = (): boolean => useContext(NarrowWindow);
