// The scroll progress of the continuous scroll triggers (plan stage 10: native ScrollTimeline / ViewTimeline, with a
// scroll listener where the browser has none; spec motion-runtime, Scroll progress):
//  - while-visible: how far the element has crossed the viewport, 0 when its top meets the viewport's bottom, 1 when its
//    bottom leaves the viewport's top (the "cover" range of CSS Scroll-driven Animations);
//  - page-scroll: how far the page is scrolled, 0 at the top, 1 at the bottom.
// The interaction's range (scrollStart to scrollEnd, in percent) narrows it: the timeline plays across that part.
// With a native timeline the browser drives the animations itself, off the main thread; the listener is the fallback
// and the source of the progress the instant actions are crossed by.
//
// Self-contained: embedded as text in the page's motion script (self-contained.test.ts).
export type ScrollKind = 'while-visible' | 'page-scroll';

export interface ScrollKit {
  // the browser's own timeline for the trigger, or null where it has none
  nativeTimeline(kind: ScrollKind, source: Element): AnimationTimeline | null;
  // the range of the interaction as an animation's rangeStart and rangeEnd read it
  nativeRange(kind: ScrollKind, start: number, end: number): readonly [string, string];
  // the progress now, 0 to 1 across the range
  progress(kind: ScrollKind, source: Element, start: number, end: number): number;
  // calls back with the progress on every scroll and resize (once per frame at most); its removal
  follow(kind: ScrollKind, source: Element, start: number, end: number, onProgress: (progress: number) => void): () => void;
}

export function createScroll(win: Window): ScrollKit {
  type Timelines = Window & {
    ScrollTimeline?: new (options: { source: Element; axis: 'block' }) => AnimationTimeline;
    ViewTimeline?: new (options: { subject: Element; axis: 'block' }) => AnimationTimeline;
  };
  const clamp = (value: number): number => Math.min(1, Math.max(0, value));

  function nativeTimeline(kind: ScrollKind, source: Element): AnimationTimeline | null {
    const timelines = win as Timelines;
    try {
      if (kind === 'page-scroll' && typeof timelines.ScrollTimeline === 'function') return new timelines.ScrollTimeline({ source: win.document.scrollingElement ?? win.document.documentElement, axis: 'block' });
      if (kind === 'while-visible' && typeof timelines.ViewTimeline === 'function') return new timelines.ViewTimeline({ subject: source, axis: 'block' });
    } catch {
      // a browser that names the constructor and refuses the options: the listener drives it
    }
    return null;
  }

  function nativeRange(kind: ScrollKind, start: number, end: number): readonly [string, string] {
    return kind === 'while-visible' ? [`cover ${start}%`, `cover ${end}%`] : [`${start}%`, `${end}%`];
  }

  function raw(kind: ScrollKind, source: Element): number {
    if (kind === 'page-scroll') {
      const root = win.document.scrollingElement ?? win.document.documentElement;
      const room = root.scrollHeight - win.innerHeight;
      return room <= 0 ? 1 : clamp(win.scrollY / room);
    }
    const box = source.getBoundingClientRect();
    const travel = win.innerHeight + box.height;
    return travel <= 0 ? 0 : clamp((win.innerHeight - box.top) / travel);
  }

  function progress(kind: ScrollKind, source: Element, start: number, end: number): number {
    const low = start / 100;
    const high = end / 100;
    return high <= low ? (raw(kind, source) >= low ? 1 : 0) : clamp((raw(kind, source) - low) / (high - low));
  }

  function follow(kind: ScrollKind, source: Element, start: number, end: number, onProgress: (value: number) => void): () => void {
    let frame = 0;
    const tick = (): void => {
      frame = 0;
      onProgress(progress(kind, source, start, end));
    };
    const schedule = (): void => {
      if (frame === 0) frame = win.requestAnimationFrame(tick);
    };
    win.addEventListener('scroll', schedule, { passive: true });
    win.addEventListener('resize', schedule, { passive: true });
    tick();
    return () => {
      win.removeEventListener('scroll', schedule);
      win.removeEventListener('resize', schedule);
      if (frame !== 0) win.cancelAnimationFrame(frame);
    };
  }

  return { nativeTimeline, nativeRange, progress, follow };
}
