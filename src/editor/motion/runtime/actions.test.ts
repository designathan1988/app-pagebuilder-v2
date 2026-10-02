import { describe, expect, it, vi } from 'vitest';
import type { Effect } from '../../../core/motion/model.ts';
import { startOn } from './compose.ts';
import { config, fakePage, type FakePage } from './fake-page.ts';

// The runtime started on a page and its kit's actions, run straight on an element.
function kitOf(page: FakePage, mode: 'page' | 'canvas' = 'page', fields: Parameters<typeof config>[0] = {}) {
  const problems: string[] = [];
  const controller = startOn(page.win as unknown as Window, config(fields), { mode, report: (problem) => problems.push(`${problem.code} ${problem.detail}`) });
  return { kit: controller.kit, problems, controller };
}
const $ = (page: FakePage, selector: string) => page.document.querySelector(selector) as HTMLElement;

describe('instant actions and their undo', () => {
  it('adds, removes and toggles a class, sets and removes an attribute, a style, a variable, the text, each undone exactly', () => {
    const page = fakePage('<div id="box" class="was" data-state="a" style="color: red">Old <b>text</b></div>');
    const { kit } = kitOf(page);
    const box = $(page, '#box');
    const run = (effect: Effect) => kit.actions.run(effect, box);
    const undoClass = run({ kind: 'class', operation: 'toggle', className: 'was' });
    expect(box.classList.contains('was')).toBe(false);
    undoClass?.();
    expect(box.classList.contains('was')).toBe(true);
    const undoAttribute = run({ kind: 'attribute', name: 'data-state', value: null });
    expect(box.hasAttribute('data-state')).toBe(false);
    undoAttribute?.();
    expect(box.getAttribute('data-state')).toBe('a');
    const undoStyle = run({ kind: 'style', property: 'color', value: 'blue' });
    expect(box.style.color).toBe('blue');
    undoStyle?.();
    expect(box.style.color).toBe('red');
    const undoVariable = run({ kind: 'variable', name: '--size', value: '12px' });
    expect(box.style.getPropertyValue('--size')).toBe('12px');
    undoVariable?.();
    expect(box.style.getPropertyValue('--size')).toBe('');
    const bold = box.querySelector('b');
    const undoText = run({ kind: 'text', value: 'New' });
    expect(box.textContent).toBe('New');
    undoText?.();
    expect(box.querySelector('b')).toBe(bold);
    expect(kit.actions.reversible({ kind: 'navigate', to: 'back', newTab: false })).toBe(false);
    expect(kit.actions.reversible({ kind: 'class', operation: 'add', className: 'x' })).toBe(true);
  });

  it('shows and hides by the hidden attribute or by visibility', () => {
    const page = fakePage('<p id="panel" hidden>Panel</p><p id="note">Note</p>');
    const { kit } = kitOf(page);
    const undoShow = kit.actions.run({ kind: 'display', operation: 'show', transition: 'none', mode: 'hidden' }, $(page, '#panel'));
    expect($(page, '#panel').hidden).toBe(false);
    undoShow?.();
    expect($(page, '#panel').hidden).toBe(true);
    kit.actions.run({ kind: 'display', operation: 'hide', transition: 'none', mode: 'visibility' }, $(page, '#note'));
    expect($(page, '#note').style.visibility).toBe('hidden');
  });

  it('opens and closes a dialog and details through their own API', () => {
    const page = fakePage('<dialog id="modal"><p>Hi</p></dialog><details id="faq"><summary>Q</summary>A</details>');
    const { kit } = kitOf(page);
    const dialog = $(page, '#modal') as HTMLDialogElement;
    const undo = kit.actions.run({ kind: 'dialog', operation: 'open-modal' }, dialog);
    expect(dialog.open).toBe(true);
    undo?.();
    expect(dialog.open).toBe(false);
    kit.actions.run({ kind: 'details', operation: 'toggle' }, $(page, '#faq'));
    expect(($(page, '#faq') as HTMLDetailsElement).open).toBe(true);
  });

  it('selects a tab by clicking it, as the tabs\' own script listens', () => {
    const page = fakePage('<div id="tabs"><div role="tablist"><button role="tab">A</button><button role="tab">B</button></div></div>');
    const { kit } = kitOf(page);
    const clicked = vi.fn();
    page.document.querySelectorAll('[role="tab"]')[1]?.addEventListener('click', clicked);
    kit.actions.run({ kind: 'tab', index: 1 }, $(page, '#tabs'));
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('changes the slide of a carousel, marking the current one and saying so', () => {
    const page = fakePage('<div id="slides"><section>1</section><section>2</section><section>3</section></div>');
    const { kit } = kitOf(page);
    const changed = vi.fn();
    $(page, '#slides').addEventListener('builder:slide-change', changed);
    kit.actions.run({ kind: 'slide', operation: 'previous' }, $(page, '#slides'));
    const slides = [...page.document.querySelectorAll('section')] as HTMLElement[];
    expect(slides.map((one) => one.getAttribute('aria-current'))).toEqual([null, null, 'true']);
    expect(slides.map((one) => one.hidden)).toEqual([true, true, false]);
    expect(changed).toHaveBeenCalledTimes(1);
    kit.actions.run({ kind: 'slide', operation: 'go', index: 0 }, $(page, '#slides'));
    expect(slides[0]?.getAttribute('aria-current')).toBe('true');
  });

  it('plays, pauses and mutes media, saying a refused play', async () => {
    const page = fakePage('<div id="box"><video src="clip.mp4"></video></div>');
    const { kit, problems } = kitOf(page);
    const video = page.document.querySelector('video') as HTMLVideoElement;
    video.play = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    kit.actions.run({ kind: 'media', operation: 'play' }, $(page, '#box'));
    await Promise.resolve();
    await Promise.resolve();
    expect(problems.some((one) => one.startsWith('media-refused'))).toBe(true);
    kit.actions.run({ kind: 'media', operation: 'toggle-mute' }, video);
    expect(video.muted).toBe(true);
  });

  it('sends a custom event that bubbles, focuses, and clears a form', () => {
    const page = fakePage('<form id="form"><input id="field" value="x"></form>');
    const { kit } = kitOf(page);
    const heard = vi.fn();
    page.document.body.addEventListener('menu:open', (event) => heard((event as CustomEvent).detail));
    kit.actions.run({ kind: 'event', name: 'menu:open', detail: 'main' }, $(page, '#field'));
    expect(heard).toHaveBeenCalledWith('main');
    kit.actions.run({ kind: 'focus', operation: 'focus' }, $(page, '#field'));
    expect(page.document.activeElement).toBe($(page, '#field'));
    ($(page, '#field') as HTMLInputElement).value = 'typed';
    kit.actions.run({ kind: 'form', operation: 'reset' }, $(page, '#field'));
    expect(($(page, '#field') as HTMLInputElement).value).toBe('x');
  });

  it('never leaves the editor on the canvas: no navigation, no submission', () => {
    const page = fakePage('<form id="form"><button id="send">Send</button></form>');
    const { kit } = kitOf(page, 'canvas');
    const submitted = vi.fn();
    $(page, '#form').addEventListener('submit', submitted);
    kit.actions.run({ kind: 'form', operation: 'submit' }, $(page, '#send'));
    kit.actions.run({ kind: 'navigate', to: 'url', address: 'https://example.com/', newTab: false }, $(page, '#send'));
    expect(submitted).not.toHaveBeenCalled();
    expect(page.win.location.href).toBe('https://example.org/site/index.html');
  });

  it('goes to a page of the site from the site\'s root, in a new tab when asked', () => {
    const page = fakePage('<a id="here">x</a>');
    const opened = vi.fn();
    (page.win as unknown as { open: unknown }).open = opened;
    const { kit } = kitOf(page);
    kit.actions.run({ kind: 'navigate', to: 'page', address: 'about/index.html', newTab: true }, $(page, '#here'));
    expect(opened).toHaveBeenCalledWith('https://example.org/site/about/index.html', '_blank', 'noopener,noreferrer');
  });

  it('copies the target\'s text to the clipboard', async () => {
    const page = fakePage('<p id="code"> npm install </p>');
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(page.win.navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { kit } = kitOf(page);
    kit.actions.run({ kind: 'clipboard', source: 'target-text' }, $(page, '#code'));
    expect(writeText).toHaveBeenCalledWith('npm install');
  });

  it('switches the theme on the root, with color-scheme, remembered between visits', () => {
    const page = fakePage('<button id="switch">Theme</button>');
    const { kit } = kitOf(page);
    const root = page.document.documentElement;
    const undo = kit.actions.run({ kind: 'theme', operation: 'toggle', remember: true }, $(page, '#switch'));
    expect(root.classList.contains('theme-dark')).toBe(true);
    expect(root.style.getPropertyValue('color-scheme')).toBe('dark');
    expect(page.win.localStorage.getItem('builder-theme')).toBe('dark');
    undo?.();
    expect(root.classList.contains('theme-dark')).toBe(false);
    // a remembered theme holds before anything plays on the next visit
    const next = fakePage('<div></div>');
    next.win.localStorage.setItem('builder-theme', 'dark');
    kitOf(next, 'page', { timelines: { Theme: { name: 'Theme', markers: [], actions: [{ id: 't', target: { kind: 'self' }, start: 0, duration: 0, effect: { kind: 'theme', operation: 'toggle', remember: true } }] } } });
    expect(next.document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('restarts a CSS animation an event plays by its class, and controls a running one by its name', () => {
    const page = fakePage('<div id="box"></div>');
    const { kit } = kitOf(page, 'page', { cssAnimations: { pop: 'anim-pop' } });
    const box = $(page, '#box');
    kit.actions.run({ kind: 'css-animation', operation: 'play', animation: 'pop' }, box);
    expect(box.classList.contains('anim-pop')).toBe(true);
    const running = box.animate([], { duration: 1000 }) as unknown as { animationName: string; currentTime: number; playState: string };
    running.animationName = 'spin';
    kit.actions.run({ kind: 'css-animation', operation: 'seek', animation: 'spin', time: 400 }, box);
    expect(running.currentTime).toBe(400);
    kit.actions.run({ kind: 'css-animation', operation: 'pause', animation: 'spin' }, box);
    expect(running.playState).toBe('paused');
  });

  it('plays a Lottie animation with its data, one player per element and file, and says a missing player', () => {
    const page = fakePage('<div id="art"></div>');
    const data = { v: '5.7.0', layers: [] };
    const { kit, problems } = kitOf(page, 'page', { lottie: { 'img/a.json': data } });
    kit.actions.run({ kind: 'lottie', file: 'img/a.json', operation: 'play', loop: true, speed: 1 }, $(page, '#art'));
    expect(problems).toEqual(['lottie-missing img/a.json']);
    const player = { play: vi.fn(), pause: vi.fn(), stop: vi.fn(), setSpeed: vi.fn(), setLoop: vi.fn(), goToAndStop: vi.fn(), playSegments: vi.fn(), destroy: vi.fn() };
    const loadAnimation = vi.fn(() => player);
    (page.win as unknown as { lottie: unknown }).lottie = { loadAnimation };
    const fresh = kitOf(page, 'page', { lottie: { 'img/a.json': data } });
    fresh.kit.actions.run({ kind: 'lottie', file: 'img/a.json', operation: 'segment', loop: false, speed: 2, from: 10, to: 40 }, $(page, '#art'));
    fresh.kit.actions.run({ kind: 'lottie', file: 'img/a.json', operation: 'pause', loop: false, speed: 2 }, $(page, '#art'));
    expect(loadAnimation).toHaveBeenCalledTimes(1);
    expect((loadAnimation.mock.calls[0] as readonly unknown[] | undefined)?.[0]).toMatchObject({ renderer: 'svg', loop: false, autoplay: false, animationData: data });
    expect(player.playSegments).toHaveBeenCalledWith([10, 40], true);
    expect(player.setSpeed).toHaveBeenCalledWith(2);
    expect(player.pause).toHaveBeenCalled();
    fresh.controller.dispose();
    expect(player.destroy).toHaveBeenCalled();
  });

  it('scrolls to a target smoothly, or at once when less motion is asked', () => {
    const page = fakePage('<div id="far"></div>');
    const scrollTo = vi.fn();
    (page.win as unknown as { scrollTo: unknown }).scrollTo = scrollTo;
    const { kit } = kitOf(page);
    kit.actions.run({ kind: 'scroll', to: 'top', offset: 0, smooth: true, block: 'start' }, $(page, '#far'));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
    page.reduceMotion(true);
    kit.actions.run({ kind: 'scroll', to: 'target', offset: -20, smooth: true, block: 'start' }, $(page, '#far'));
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ behavior: 'auto' });
  });
});
