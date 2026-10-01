// Nonmodal layers share one outside-press and focus policy. The pointer owner publishes the press;
// no shield consumes it. Portal children protect their parent through their trigger, not DOM ancestry alone.
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { outsidePress } from '../input/pointer/views.ts';

interface Layer {
  readonly panel: HTMLElement;
  readonly anchor: HTMLElement | null;
  readonly dismiss: () => void;
}
const layers = new Set<Layer>();
outsidePress.subscribe((target) => {
  const inside = new Set([...layers].filter((layer) => layer.panel.contains(target) || layer.anchor?.contains(target)));
  for (const child of inside) {
    for (const parent of layers) if (child.anchor && parent.panel.contains(child.anchor)) inside.add(parent);
  }
  for (const layer of [...layers].reverse()) if (!inside.has(layer)) layer.dismiss();
});

export function useOutsideLayer(panel: RefObject<HTMLElement | null>, open: boolean, close: () => void, anchor?: RefObject<HTMLElement | null>, restoreFocus = true): void {
  const latest = useRef(close);
  useLayoutEffect(() => { latest.current = close; });
  useLayoutEffect(() => {
    const own = panel.current;
    if (!open || !own) return;
    const before = anchor?.current ?? document.activeElement;
    const restore = before instanceof HTMLElement && before !== document.body ? before : null;
    let outside = false;
    const layer: Layer = {
      panel: own,
      anchor: anchor?.current ?? null,
      dismiss: () => { outside = true; latest.current(); },
    };
    layers.add(layer);
    return () => {
      layers.delete(layer);
      const focused = document.activeElement;
      if (restoreFocus && !outside && restore?.isConnected && (focused === document.body || focused === null || own.contains(focused))) restore.focus();
    };
  }, [panel, open, anchor, restoreFocus]);
}
