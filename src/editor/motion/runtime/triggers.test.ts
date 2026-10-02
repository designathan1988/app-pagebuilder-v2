import { describe, expect, it, vi } from 'vitest';
import type { Trigger } from '../../../core/motion/model.ts';
import { TRIGGER_KINDS } from '../../../core/motion/catalog.ts';
import { startOn } from './compose.ts';
import { config, fakePage, type FakePage } from './fake-page.ts';

// A trigger bound on an element, with what it called back.
function bound(page: FakePage, trigger: Trigger, selector = '#box', range = { start: 0, end: 100 }) {
  const controller = startOn(page.win as unknown as Window, config({}), { mode: 'page', report: () => undefined });
  const calls: string[] = [];
  const handlers = { fire: () => calls.push('fire'), leave: () => calls.push('leave'), progress: (value: number) => calls.push(`progress ${value.toFixed(2)}`), duration: () => 600 };
  const dispose = controller.kit.triggers.bind(trigger, page.document.querySelector(selector) as Element, handlers, range);
  return { calls, dispose, controller };
}
// an event of the fake page's own window, made by its own constructors
const event = (page: FakePage, kind: 'Event' | 'MouseEvent' | 'PointerEvent' | 'KeyboardEvent' | 'FocusEvent', type: string, init: Record<string, unknown> = {}): Event => {
  const Make = (page.win as unknown as Partial<Record<string, new (type: string, init?: object) => Event>>)[kind];
  if (Make === undefined) throw new Error(`the fake page has no ${kind}`);
  return new Make(type, init);
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the element\'s own triggers', () => {
  it('fires on its event, and stops listening once removed', () => {
    const cases: [Trigger['kind'], 'Event' | 'MouseEvent' | 'PointerEvent', string][] = [
      ['click', 'MouseEvent', 'click'],
      ['double-click', 'MouseEvent', 'dblclick'],
      ['pointer-down', 'PointerEvent', 'pointerdown'],
      ['pointer-up', 'PointerEvent', 'pointerup'],
      ['pointer-enter', 'PointerEvent', 'pointerenter'],
      ['pointer-leave', 'PointerEvent', 'pointerleave'],
      ['focus', 'Event', 'focus'],
      ['blur', 'Event', 'blur'],
      ['input', 'Event', 'input'],
      ['change', 'Event', 'change'],
      ['form-submit', 'Event', 'submit'],
    ];
    for (const [kind, constructor, type] of cases) {
      const page = fakePage('<form id="box"><input></form>');
      const { calls, dispose } = bound(page, { kind });
      page.document.querySelector('#box')?.dispatchEvent(event(page, constructor, type));
      dispose();
      page.document.querySelector('#box')?.dispatchEvent(event(page, constructor, type));
      expect(calls, kind).toEqual(['fire']);
    }
  });

  it('pairs hover\'s enter with its leave, and focus within with the focus leaving', () => {
    const page = fakePage('<div id="box"><input id="a"><input id="b"></div><input id="out">');
    const hover = bound(page, { kind: 'hover' });
    const box = page.document.querySelector('#box') as Element;
    box.dispatchEvent(event(page, 'PointerEvent', 'pointerenter'));
    box.dispatchEvent(event(page, 'PointerEvent', 'pointerleave'));
    expect(hover.calls).toEqual(['fire', 'leave']);
    const within = bound(page, { kind: 'focus-within' });
    const a = page.document.querySelector('#a') as Element;
    a.dispatchEvent(event(page, 'FocusEvent', 'focusin', { bubbles: true }));
    // the focus moving inside is no leaving
    a.dispatchEvent(event(page, 'FocusEvent', 'focusout', { bubbles: true, relatedTarget: page.document.querySelector('#b') }));
    a.dispatchEvent(event(page, 'FocusEvent', 'focusout', { bubbles: true, relatedTarget: page.document.querySelector('#out') }));
    expect(within.calls).toEqual(['fire', 'leave']);
  });

  it('follows the pointer across the element as its progress', () => {
    const page = fakePage('<div id="box"></div>');
    const box = page.document.querySelector('#box') as HTMLElement;
    box.getBoundingClientRect = () => ({ left: 100, top: 0, width: 200, height: 50, right: 300, bottom: 50, x: 100, y: 0, toJSON: () => ({}) }) as DOMRect;
    const { calls } = bound(page, { kind: 'pointer-move', axis: 'x' });
    box.dispatchEvent(event(page, 'PointerEvent', 'pointermove', { clientX: 150 }));
    box.dispatchEvent(event(page, 'PointerEvent', 'pointermove', { clientX: 400 }));
    expect(calls).toEqual(['progress 0.25', 'progress 1.00']);
  });

  it('fires on its key only, and a key typed into a field belongs to the field', () => {
    const page = fakePage('<div id="box" tabindex="0"></div><input id="field">');
    const own = bound(page, { kind: 'key', key: 'k' });
    const box = page.document.querySelector('#box') as Element;
    box.dispatchEvent(event(page, 'KeyboardEvent', 'keydown', { key: 'j' }));
    box.dispatchEvent(event(page, 'KeyboardEvent', 'keydown', { key: 'K' }));
    box.dispatchEvent(event(page, 'KeyboardEvent', 'keydown', { key: 'k', repeat: true }));
    expect(own.calls).toEqual(['fire']);
    const anywhere = bound(page, { kind: 'key', key: 'Escape' }, 'body');
    page.document.querySelector('#field')?.dispatchEvent(event(page, 'KeyboardEvent', 'keydown', { key: 'Escape', bubbles: true }));
    page.document.body.dispatchEvent(event(page, 'KeyboardEvent', 'keydown', { key: 'Escape', bubbles: true }));
    expect(anywhere.calls).toEqual(['fire']);
  });

  it('fires once per attempt on an invalid form, and on a long press that does not travel', async () => {
    const page = fakePage('<form id="box"><input required><input required></form>');
    const invalid = bound(page, { kind: 'form-invalid' });
    for (const input of page.document.querySelectorAll('input')) input.dispatchEvent(event(page, 'Event', 'invalid'));
    await flush();
    expect(invalid.calls).toEqual(['fire']);
    const press = bound(page, { kind: 'long-press', milliseconds: 20 });
    const box = page.document.querySelector('#box') as Element;
    box.dispatchEvent(event(page, 'PointerEvent', 'pointerdown', { clientX: 0, clientY: 0 }));
    box.dispatchEvent(event(page, 'PointerEvent', 'pointermove', { clientX: 50, clientY: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(press.calls).toEqual([]);
    box.dispatchEvent(event(page, 'PointerEvent', 'pointerdown', { clientX: 0, clientY: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(press.calls).toEqual(['fire']);
  });
});

describe('scrolling', () => {
  it('fires entering the screen past its threshold, its leave when it goes, and leaving the screen', () => {
    const page = fakePage('<div id="box"></div>');
    const observers: { callback: IntersectionObserverCallback; options: IntersectionObserverInit | undefined }[] = [];
    (page.win as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observers.push({ callback, options });
      }
      observe() {}
      disconnect() {}
    };
    const entering = bound(page, { kind: 'scroll-into-view', threshold: 0.5 });
    const leaving = bound(page, { kind: 'scroll-out-of-view', threshold: 0.5 });
    const see = (ratio: number) => {
      for (const { callback } of observers) callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver);
    };
    expect(observers[0]?.options?.threshold).toEqual([0, 0.5, 1]);
    see(0.2);
    see(0.6);
    see(0);
    expect(entering.calls).toEqual(['fire', 'leave']);
    expect(leaving.calls).toEqual(['fire']);
  });

  it('says the scroll direction it plays on, and the other direction as its leave', () => {
    const page = fakePage('<div id="box"></div>');
    const { calls } = bound(page, { kind: 'scroll-direction', direction: 'down' });
    const scrollTo = (y: number) => {
      Object.defineProperty(page.win, 'scrollY', { value: y, configurable: true });
      (page.win as unknown as Window).dispatchEvent(event(page, 'Event', 'scroll'));
    };
    scrollTo(2);
    scrollTo(100);
    scrollTo(160);
    scrollTo(40);
    expect(calls).toEqual(['fire', 'leave']);
  });

  it('follows the page scroll as progress across its range', () => {
    const page = fakePage('<div id="box"></div>');
    Object.defineProperty(page.document.documentElement, 'scrollHeight', { value: 2900, configurable: true });
    Object.defineProperty(page.win, 'scrollY', { value: 1000, configurable: true });
    const { calls } = bound(page, { kind: 'page-scroll' }, '#box', { start: 0, end: 50 });
    // 1000 of 2000 is half the page: the whole of a range ending at 50 %
    expect(calls).toEqual(['progress 1.00']);
  });
});

describe('the page', () => {
  it('fires at load after every binding, on a timer, every interval, and when idle', async () => {
    const page = fakePage('<div id="box"></div>');
    const load = bound(page, { kind: 'page-load' });
    expect(load.calls).toEqual([]);
    await flush();
    expect(load.calls).toEqual(['fire']);
    const timer = bound(page, { kind: 'timer', milliseconds: 10 });
    const interval = bound(page, { kind: 'interval', milliseconds: 16 });
    const idle = bound(page, { kind: 'idle', milliseconds: 10 });
    await new Promise((resolve) => setTimeout(resolve, 60));
    interval.dispose();
    expect(timer.calls).toEqual(['fire']);
    expect(interval.calls.length).toBeGreaterThanOrEqual(2);
    // idle once until the person comes back
    expect(idle.calls).toEqual(['fire']);
  });

  it('fires on the tab\'s visibility it names', () => {
    const page = fakePage('<div id="box"></div>');
    const { calls } = bound(page, { kind: 'visibility', state: 'hidden' });
    Object.defineProperty(page.document, 'visibilityState', { value: 'hidden', configurable: true });
    page.document.dispatchEvent(event(page, 'Event', 'visibilitychange'));
    Object.defineProperty(page.document, 'visibilityState', { value: 'visible', configurable: true });
    page.document.dispatchEvent(event(page, 'Event', 'visibilitychange'));
    expect(calls).toEqual(['fire']);
  });

  it('fires entering its breakpoint, and plays a page leave before a link goes', async () => {
    const page = fakePage('<div id="box"></div><a id="link" href="about.html">About</a>');
    const { calls } = bound(page, { kind: 'breakpoint', breakpoint: 'phone' });
    page.resize(380);
    (page.win as unknown as Window).dispatchEvent(event(page, 'Event', 'resize'));
    page.resize(1200);
    (page.win as unknown as Window).dispatchEvent(event(page, 'Event', 'resize'));
    expect(calls).toEqual(['fire', 'leave']);
    const leave = bound(page, { kind: 'page-leave' });
    const assign = vi.fn();
    Object.defineProperty(page.win, 'location', { value: { href: 'https://example.org/site/index.html', assign }, configurable: true });
    const click = event(page, 'MouseEvent', 'click', { bubbles: true, cancelable: true, button: 0 });
    page.document.querySelector('#link')?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(leave.calls).toEqual(['fire']);
    await new Promise((resolve) => setTimeout(resolve, 650));
    expect(assign).toHaveBeenCalledWith('https://example.org/site/about.html');
  });
});

describe('media and components', () => {
  it('fires on media play, pause, end and when its time passes a moment', () => {
    const page = fakePage('<div id="box"><video></video></div>');
    const play = bound(page, { kind: 'media-play' });
    const time = bound(page, { kind: 'media-time', seconds: 2 });
    const video = page.document.querySelector('video') as HTMLVideoElement;
    video.dispatchEvent(event(page, 'Event', 'play'));
    let now = 1;
    Object.defineProperty(video, 'currentTime', { get: () => now, configurable: true });
    video.dispatchEvent(event(page, 'Event', 'timeupdate'));
    now = 2.1;
    video.dispatchEvent(event(page, 'Event', 'timeupdate'));
    video.dispatchEvent(event(page, 'Event', 'timeupdate'));
    expect(play.calls).toEqual(['fire']);
    expect(time.calls).toEqual(['fire']);
  });

  it('reads a dialog\'s open attribute, a dropdown\'s and a mobile menu\'s aria-expanded, a tab\'s aria-selected', async () => {
    const page = fakePage('<dialog id="box"></dialog><div id="menu"><button aria-haspopup="true" aria-expanded="false">More</button></div><header id="top"><button aria-controls="main-nav" aria-expanded="false">Menu</button><nav id="main-nav"></nav></header><div id="tabs"><button role="tab" aria-selected="true">A</button><button role="tab" aria-selected="false">B</button></div>');
    const opened = bound(page, { kind: 'dialog-open' });
    const closed = bound(page, { kind: 'dialog-close' });
    const dropdown = bound(page, { kind: 'dropdown-open' }, '#menu');
    const mobile = bound(page, { kind: 'mobile-menu-open' }, '#top');
    const tab = bound(page, { kind: 'tab-change' }, '#tabs');
    (page.document.querySelector('#box') as HTMLDialogElement).setAttribute('open', '');
    page.document.querySelector('#menu button')?.setAttribute('aria-expanded', 'true');
    page.document.querySelector('#top button')?.setAttribute('aria-expanded', 'true');
    page.document.querySelectorAll('[role="tab"]')[1]?.setAttribute('aria-selected', 'true');
    await flush();
    (page.document.querySelector('#box') as HTMLDialogElement).removeAttribute('open');
    await flush();
    expect([opened.calls, closed.calls, dropdown.calls, mobile.calls, tab.calls]).toEqual([['fire'], ['fire'], ['fire'], ['fire'], ['fire']]);
  });

  it('fires on details opening, a slide change and a custom event', async () => {
    const page = fakePage('<details id="box"><summary>Q</summary></details><div id="slides"></div><div id="custom"></div>');
    const details = bound(page, { kind: 'details-open' });
    const slide = bound(page, { kind: 'slide-change' }, '#slides');
    const custom = bound(page, { kind: 'custom', event: 'cart:add' }, '#custom');
    // the browser says the details toggled
    (page.document.querySelector('#box') as HTMLDetailsElement).open = true;
    await flush();
    page.document.querySelector('#slides')?.dispatchEvent(event(page, 'Event', 'builder:slide-change'));
    page.document.querySelector('#custom')?.dispatchEvent(event(page, 'Event', 'cart:add'));
    expect([details.calls, slide.calls, custom.calls]).toEqual([['fire'], ['fire'], ['fire']]);
  });

  it('binds every trigger of the catalogue without failing', () => {
    const page = fakePage('<form id="box"><input></form>');
    (page.win as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      observe() {}
      disconnect() {}
    };
    for (const kind of TRIGGER_KINDS) {
      const { dispose } = bound(page, { kind } as Trigger);
      dispose();
    }
  });
});
