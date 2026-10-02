// When the page on the canvas may have changed (the plan's stage 4, "laços por quadro": every field shown read the
// page's computed values at every frame, dozens of loops at once): the one clock the readers of the page measure by.
// The canvas frame says the page may have changed — the store changed (a document, a selection, a breakpoint, a
// zoom), the page loaded, a font arrived, the page's box was resized (an image that loaded) — and every reader
// measures once, at the next frame, together. Nothing measures while nothing changes.
type Listener = () => void;

const listeners = new Set<Listener>();
let scheduled = false;
// how many times the page may have changed: a measure of the page read at the same version reads the same page
let version = 0;
export const pageVersion = (): number => version;

// the page may have changed: the readers measure at the next frame, once however many times it was said
export function pageChanged(): void {
  // a read made from now on reads the changed page, whether or not the readers were told yet
  version += 1;
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    for (const listener of [...listeners]) listener();
  });
}

// a reader of the page: measured at each tick of the clock, until the returned stop
export function onPageChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
