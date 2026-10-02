import { describe, expect, it } from 'vitest';
import type { RuntimeAction, RuntimeBinding, RuntimeTimeline } from '../../../core/motion/export.ts';
import { startOn } from './compose.ts';
import { config, fakePage, type FakePage } from './fake-page.ts';

const action = (fields: Partial<RuntimeAction>): RuntimeAction => ({ id: 'a', target: { kind: 'self' }, start: 0, duration: 0, effect: { kind: 'wait' }, ...fields });
const timeline = (name: string, actions: RuntimeAction[]): RuntimeTimeline => ({ name, actions, markers: [] });

function start(page: FakePage, timelines: RuntimeTimeline[], bindings: readonly RuntimeBinding[] = [{ selector: '#box', interaction: { trigger: { kind: 'click' }, timeline: timelines[0]?.name ?? '', control: 'play' as const } }]) {
  const problems: string[] = [];
  const controller = startOn(page.win as unknown as Window, config({ bindings, timelines: Object.fromEntries(timelines.map((one) => [one.name, one])) }), { mode: 'page', report: (problem) => problems.push(problem.code) });
  return { controller, problems, box: page.document.querySelector('#box') as HTMLElement };
}
const click = (element: Element) => element.dispatchEvent(new (element.ownerDocument.defaultView as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent('click', { bubbles: true }));

describe('a timeline played on its source', () => {
  it('makes one animation per property track, delayed to its start and padded to the run\'s end, held at 0 until it plays', () => {
    const page = fakePage('<div id="box"></div>');
    start(page, [
      timeline('Intro', [
        action({ id: 'fade', start: 200, duration: 600, easing: 'ease-out', effect: { kind: 'animate', tracks: [{ id: 'o', property: 'opacity', keyframes: [{ id: '1', time: 0, value: '0', easing: 'ease-in' }, { id: '2', time: 600, value: '1' }] }, { id: 'c', property: 'background-color', keyframes: [{ id: '3', time: 300, value: 'red' }] }] } }),
        action({ id: 'wait', start: 800, duration: 400 }),
      ]),
    ]);
    const [master, opacity, colour] = page.animations;
    expect(master?.keyframes).toBeNull();
    expect(master?.options).toMatchObject({ duration: 1200, fill: 'both' });
    expect(opacity?.keyframes).toEqual([{ offset: 0, opacity: '0', easing: 'ease-in' }, { offset: 1, opacity: '1', easing: 'linear' }]);
    expect(opacity?.options).toMatchObject({ delay: 200, duration: 600, endDelay: 400, easing: 'ease-out', fill: 'both', iterations: 1, direction: 'normal' });
    // a property keyed only part way: its keyframes offsets inside the action, its own name in the camel case WAAPI reads
    expect(colour?.keyframes).toEqual([{ offset: 0.5, backgroundColor: 'red', easing: 'linear' }]);
    expect(page.animations.every((one) => one.playState === 'paused' && one.currentTime === 0)).toBe(true);
  });

  it('crosses its instant actions as the clock passes them, and undoes them going back', () => {
    const page = fakePage('<div id="box"></div>');
    const { box } = start(page, [timeline('Intro', [action({ id: 'on', start: 300, effect: { kind: 'class', operation: 'add', className: 'is-on' } }), action({ id: 'long', start: 0, duration: 600 })])]);
    click(box);
    page.tick(200);
    expect(box.classList.contains('is-on')).toBe(false);
    page.tick(200);
    expect(box.classList.contains('is-on')).toBe(true);
    page.tick(500);
    // played to its end: the run rests there
    expect(page.animations[0]?.currentTime).toBe(600);
  });

  it('plays backwards on its leaving half and puts the page back as it was before the trigger', () => {
    const page = fakePage('<div id="box"></div>');
    const { box } = start(page, [timeline('Hover', [action({ id: 'on', start: 0, effect: { kind: 'class', operation: 'add', className: 'is-hover' } }), action({ id: 'long', duration: 400 })])], [{ selector: '#box', interaction: { trigger: { kind: 'hover' }, timeline: 'Hover', control: 'play', leave: 'reverse' } }]);
    const pointer = (type: string) => box.dispatchEvent(new (page.win as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent(type));
    pointer('pointerenter');
    expect(box.classList.contains('is-hover')).toBe(true);
    page.tick(400);
    pointer('pointerleave');
    expect(page.animations.every((one) => one.playbackRate === -1)).toBe(true);
    page.tick(200);
    expect(box.classList.contains('is-hover')).toBe(true);
    page.tick(250);
    expect(box.classList.contains('is-hover')).toBe(false);
  });

  it('jumps to its end at once when less motion is asked, every cue crossed, nothing moving', () => {
    const page = fakePage('<div id="box"></div>');
    page.reduceMotion(true);
    const { box } = start(page, [timeline('Intro', [action({ id: 'fade', duration: 800, effect: { kind: 'animate', tracks: [{ id: 'o', property: 'opacity', keyframes: [{ id: '1', time: 0, value: '0' }] }] } }), action({ id: 'on', start: 800, effect: { kind: 'class', operation: 'add', className: 'done' } })])]);
    click(box);
    expect(box.classList.contains('done')).toBe(true);
    expect(page.animations.every((one) => one.currentTime === 800 && one.playState === 'paused')).toBe(true);
  });

  it('plays as made when the interaction ignores reduced motion', () => {
    const page = fakePage('<div id="box"></div>');
    page.reduceMotion(true);
    const { box } = start(page, [timeline('Intro', [action({ id: 'long', duration: 800 })])], [{ selector: '#box', interaction: { trigger: { kind: 'click' }, timeline: 'Intro', control: 'play', reducedMotion: 'ignore' } }]);
    click(box);
    expect(page.animations[0]?.playState).toBe('running');
    expect(page.animations[0]?.currentTime).toBe(0);
  });

  it('staggers its targets from the end, the centre or a seeded random order, the same on every page', () => {
    const page = fakePage('<ul id="box"><li></li><li></li><li></li><li></li></ul>');
    const fade = (from: 'start' | 'end' | 'center' | 'random') => action({ id: `s-${from}`, target: { kind: 'children' }, start: 100, duration: 300, stagger: { each: 100, from }, effect: { kind: 'animate', tracks: [{ id: 'o', property: 'opacity', keyframes: [{ id: '1', time: 0, value: '0' }] }] } });
    start(page, [timeline('End', [fade('end')]), timeline('Center', [fade('center')]), timeline('Random', [fade('random')])], ['End', 'Center', 'Random'].map((name) => ({ selector: '#box', interaction: { trigger: { kind: 'click' }, timeline: name, control: 'play' as const } })));
    const delays = (index: number) => page.animations.filter((one) => one.keyframes !== null).slice(index * 4, index * 4 + 4).map((one) => one.options.delay);
    expect(delays(0)).toEqual([400, 300, 200, 100]);
    expect(delays(1)).toEqual([250, 150, 150, 250]);
    expect([...(delays(2) as number[])].sort()).toEqual([100, 200, 300, 400]);
    // the run lasts until its last target ends
    expect(page.animations.find((one) => one.keyframes === null)?.options.duration).toBe(700);
  });

  it('keys a transform part on a registered custom property, composed after the element\'s own transform, given back when it stops', () => {
    const page = fakePage('<div id="box" style="transform: rotate(5deg)"></div>');
    const { controller, box } = start(page, [timeline('Rise', [action({ id: 'up', duration: 500, effect: { kind: 'animate', tracks: [{ id: 'y', property: 'translate-y', keyframes: [{ id: '1', time: 0, value: '2em' }, { id: '2', time: 500, value: '0em' }] }] } })])]);
    const rise = page.animations[1];
    expect(rise?.keyframes?.[0]).toMatchObject({ '--bm-translate-y': '2em' });
    expect(box.style.transform).toContain('translate3d(var(--bm-translate-x, 0px), var(--bm-translate-y, 0px), var(--bm-translate-z, 0px))');
    controller.dispose();
    expect(box.style.transform).toBe('rotate(5deg)');
  });

  it('previews a time without playing: only actions that can be undone run, and they are undone going back', () => {
    const page = fakePage('<div id="box"></div>');
    const { controller, box } = start(page, [timeline('Intro', [action({ id: 'on', start: 100, effect: { kind: 'attribute', name: 'aria-expanded', value: 'true' } }), action({ id: 'go', start: 100, effect: { kind: 'navigate', to: 'url', address: 'https://example.com/', newTab: false } }), action({ id: 'long', duration: 500 })])]);
    controller.preview('Intro', 300);
    expect(box.getAttribute('aria-expanded')).toBe('true');
    expect(page.win.location.href).toBe('https://example.org/site/index.html');
    expect(page.animations.every((one) => one.currentTime === 300)).toBe(true);
    controller.preview('Intro', 0);
    expect(box.hasAttribute('aria-expanded')).toBe(false);
  });

  it('shows with its transition and hides at its end, and comes back as it was played backwards', () => {
    const page = fakePage('<div id="box"></div><p id="panel" hidden>Panel</p>');
    const panel = page.document.querySelector('#panel') as HTMLElement;
    const { box } = start(page, [timeline('Toggle', [action({ id: 'show', target: { kind: 'selector', selector: '#panel' }, duration: 300, effect: { kind: 'display', operation: 'toggle', transition: 'slide-up', mode: 'hidden' } })])], [{ selector: '#box', interaction: { trigger: { kind: 'click' }, timeline: 'Toggle', control: 'toggle' } }]);
    click(box);
    expect(panel.hidden).toBe(false);
    const slide = page.animations.at(-1);
    expect(slide?.keyframes).toEqual([{ opacity: 0, translate: '0 1em' }, { opacity: 1, translate: '0 0' }]);
    page.tick(300);
    page.tick(0);
    // the toggle's second click plays it backwards to before it showed
    click(box);
    page.tick(300);
    page.tick(0);
    expect(panel.hidden).toBe(true);
  });

  it('controls another timeline, its targets the sources of that run', () => {
    const page = fakePage('<div id="box"></div><div class="card"></div><div class="card"></div>');
    start(page, [timeline('Main', [action({ id: 'go', target: { kind: 'class', className: 'card' }, effect: { kind: 'timeline', operation: 'play', timeline: 'Card' } })]), timeline('Card', [action({ id: 'on', effect: { kind: 'class', operation: 'add', className: 'lit' } })])]);
    click(page.document.querySelector('#box') as Element);
    expect([...page.document.querySelectorAll('.card.lit')]).toHaveLength(2);
  });

  it('says a timeline the data lacks instead of failing', () => {
    const page = fakePage('<div id="box"></div>');
    const { problems } = start(page, [], [{ selector: '#box', interaction: { trigger: { kind: 'click' }, timeline: 'Ghost', control: 'play' } }]);
    expect(problems).toEqual(['timeline-missing']);
  });

  it('puts the page back as it was when it stops: classes, splits, compositions', () => {
    const page = fakePage('<div id="box"><p id="text">Hello <strong>bold</strong> world</p></div>');
    const text = page.document.querySelector('#text') as HTMLElement;
    const before = text.innerHTML;
    const nodes = [...text.childNodes];
    const { controller, box } = start(page, [timeline('Words', [action({ id: 'split', target: { kind: 'selector', selector: '#text' }, duration: 600, effect: { kind: 'split-text', by: 'word', tracks: [{ id: 'o', property: 'opacity', keyframes: [{ id: '1', time: 0, value: '0' }] }] } }), action({ id: 'on', effect: { kind: 'class', operation: 'add', className: 'played' } })])]);
    // the pieces exist from the start (each word hidden by its first keyframe before it plays)
    expect(text.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(3);
    expect(text.querySelector('strong span')?.textContent).toBe('bold');
    click(box);
    controller.dispose();
    expect(box.classList.contains('played')).toBe(false);
    expect(text.innerHTML).toBe(before);
    expect([...text.childNodes]).toEqual(nodes);
  });
});
