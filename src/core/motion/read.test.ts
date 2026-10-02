import { describe, expect, it } from 'vitest';
import { readBehaviour, readInteraction, readTimeline } from './read.ts';

const action = (fields: Record<string, unknown> = {}) => ({ id: 'a1', target: { kind: 'self' }, start: 0, duration: 600, effect: { kind: 'animate', tracks: [] }, ...fields });
const timeline = (actions: readonly unknown[], fields: Record<string, unknown> = {}) => ({ id: 't1', name: 'Hero click', actions, markers: [], ...fields });
const issuesOf = (read: { readonly ok: boolean; readonly issues?: readonly { readonly path: string; readonly reason: string }[] }) => (read.ok ? [] : (read.issues ?? []).map((issue) => issue.path));

describe('a timeline read strictly', () => {
  it('takes a timeline of every shape the model holds', () => {
    const read = readTimeline(
      timeline(
        [
          action({ easing: 'spring(1, 170, 26)', repeat: 'infinite', yoyo: true, stagger: { each: 40, from: 'random' }, effect: { kind: 'animate', tracks: [{ id: 'k', property: 'translate-y', keyframes: [{ id: 'f1', time: 0, value: '1em', easing: 'ease-in' }, { id: 'f2', time: 600, value: '0em' }] }, { id: 'k2', property: '--glow', keyframes: [{ id: 'f3', time: 300, value: '4px' }] }] } }),
          action({ id: 'a2', duration: 0, target: { kind: 'element', node: 'n-intro' }, effect: { kind: 'attribute', name: 'aria-expanded', value: null } }),
          action({ id: 'a3', duration: 0, target: { kind: 'ancestor', className: 'card' }, effect: { kind: 'navigate', to: 'url', address: 'https://example.com/a', newTab: true } }),
          action({ id: 'a4', duration: 0, effect: { kind: 'navigate', to: 'back', newTab: false } }),
          action({ id: 'a5', duration: 0, effect: { kind: 'slide', operation: 'go', index: 2 } }),
          action({ id: 'a6', duration: 0, effect: { kind: 'lottie', file: 'img/hero.json', operation: 'segment', loop: false, speed: 1, from: 0, to: 30 } }),
        ],
        { markers: [{ id: 'm1', name: 'Peak', time: 300 }] },
      ),
    );
    expect(issuesOf(read)).toEqual([]);
  });

  it('refuses a field the model does not hold, anywhere', () => {
    expect(issuesOf(readTimeline({ ...timeline([]), extra: 1 }))).toEqual(['extra']);
    expect(issuesOf(readTimeline(timeline([action({ colour: 'red' })])))).toEqual(['actions/0/colour']);
    expect(issuesOf(readTimeline(timeline([action({ duration: 0, effect: { kind: 'class', operation: 'add', className: 'x', why: 1 } })])))).toEqual(['actions/0/effect/why']);
  });

  it('refuses ids used twice, keyframes out of order or outside their action, and an instant action that lasts', () => {
    const track = (keyframes: unknown[]) => ({ kind: 'animate', tracks: [{ id: 'k', property: 'opacity', keyframes }] });
    expect(issuesOf(readTimeline(timeline([action(), action()])))).toEqual(['actions/1/id']);
    expect(issuesOf(readTimeline(timeline([action({ effect: track([{ id: 'f1', time: 300, value: '1' }, { id: 'f2', time: 100, value: '0' }]) })])))).toEqual(['actions/0/effect/tracks/0/keyframes/1/time']);
    expect(issuesOf(readTimeline(timeline([action({ effect: track([{ id: 'f1', time: 700, value: '1' }]) })])))).toEqual(['actions/0/effect/tracks/0/keyframes/0/time']);
    expect(issuesOf(readTimeline(timeline([action({ effect: { kind: 'class', operation: 'add', className: 'is-open' } })])))).toEqual(['actions/0/duration']);
  });

  it('refuses what would run code or break out of a declaration', () => {
    const one = (effect: unknown) => issuesOf(readTimeline(timeline([action({ duration: 0, effect })])));
    expect(one({ kind: 'attribute', name: 'onclick', value: 'x()' })).toEqual(['actions/0/effect/name']);
    expect(one({ kind: 'attribute', name: 'href', value: '#' })).toEqual(['actions/0/effect/name']);
    expect(one({ kind: 'style', property: 'color', value: 'red; background: url(x)' })).toEqual(['actions/0/effect/value']);
    expect(one({ kind: 'navigate', to: 'url', address: 'javascript:alert(1)', newTab: false })).toEqual(['actions/0/effect/address']);
    expect(one({ kind: 'event', name: '1-bad' })).toEqual(['actions/0/effect/name']);
    expect(one({ kind: 'variable', name: 'no-dashes', value: '1' })).toEqual(['actions/0/effect/name']);
    expect(one({ kind: 'lottie', file: '../secret.json', operation: 'play', loop: false, speed: 1 })).toEqual(['actions/0/effect/file']);
  });

  it('reads an option that belongs to one form of an effect only in that form', () => {
    const one = (effect: unknown) => issuesOf(readTimeline(timeline([action({ duration: 0, effect })])));
    expect(one({ kind: 'slide', operation: 'next', index: 1 })).toEqual(['actions/0/effect/index']);
    expect(one({ kind: 'clipboard', source: 'target-text', text: 'x' })).toEqual(['actions/0/effect/text']);
    expect(one({ kind: 'lottie', file: '', operation: 'seek', loop: false, speed: 1 })).toEqual(['actions/0/effect/from']);
    expect(one({ kind: 'lottie', file: '', operation: 'segment', loop: false, speed: 1, from: 30, to: 10 })).toEqual(['actions/0/effect/to']);
  });

  it('names a timeline as a person reads it: letters or digits first, at most 64 characters', () => {
    expect(issuesOf(readTimeline(timeline([], { name: 'Ação de entrada 2' })))).toEqual([]);
    expect(issuesOf(readTimeline(timeline([], { name: ' leading space' })))).toEqual(['name']);
    expect(issuesOf(readTimeline(timeline([], { name: 'x'.repeat(65) })))).toEqual(['name']);
  });
});

describe('an interaction read strictly', () => {
  const interaction = (fields: Record<string, unknown>) => ({ id: 'm1', trigger: { kind: 'click' }, timeline: 'Hero click', control: 'play', ...fields });

  it('takes a trigger with exactly the options it reads', () => {
    expect(readInteraction(interaction({ trigger: { kind: 'key', key: 'k' } })).ok).toBe(true);
    expect(issuesOf(readInteraction(interaction({ trigger: { kind: 'key' } })))).toEqual(['trigger/key']);
    expect(issuesOf(readInteraction(interaction({ trigger: { kind: 'click', key: 'k' } })))).toEqual(['trigger/key']);
    expect(issuesOf(readInteraction(interaction({ trigger: { kind: 'shake' } })))).toEqual(['trigger']);
    expect(issuesOf(readInteraction(interaction({ trigger: { kind: 'interval', milliseconds: 5 } })))).toEqual(['trigger/milliseconds']);
  });

  it('scrubs with a continuous trigger, and only with one', () => {
    expect(readInteraction(interaction({ trigger: { kind: 'page-scroll' }, control: 'scrub' })).ok).toBe(true);
    expect(issuesOf(readInteraction(interaction({ trigger: { kind: 'page-scroll' }, control: 'play' })))).toEqual(['control']);
    expect(issuesOf(readInteraction(interaction({ control: 'scrub' })))).toEqual(['control']);
  });

  it('gives a leaving half to a paired trigger only, and a scroll range to a scroll progress one only', () => {
    expect(readInteraction(interaction({ trigger: { kind: 'hover' }, leave: 'reverse' })).ok).toBe(true);
    expect(issuesOf(readInteraction(interaction({ leave: 'reverse' })))).toEqual(['leave']);
    expect(readInteraction(interaction({ trigger: { kind: 'while-visible' }, control: 'scrub', scrollStart: 10, scrollEnd: 90 })).ok).toBe(true);
    expect(issuesOf(readInteraction(interaction({ trigger: { kind: 'while-visible' }, control: 'scrub', scrollStart: 90, scrollEnd: 10 })))).toEqual(['scrollEnd']);
    expect(issuesOf(readInteraction(interaction({ scrollStart: 10, scrollEnd: 90 })))).toEqual(['scrollStart']);
  });

  it('reads its options: a class scope, once as true, breakpoints listed once each', () => {
    expect(readInteraction(interaction({ scope: 'card', once: true, delay: 200, breakpoints: ['tablet', 'phone'], reducedMotion: 'ignore' })).ok).toBe(true);
    expect(issuesOf(readInteraction(interaction({ once: false })))).toEqual(['once']);
    expect(issuesOf(readInteraction(interaction({ breakpoints: ['tablet', 'tablet'] })))).toEqual(['breakpoints']);
    expect(issuesOf(readInteraction(interaction({ scope: '.card' })))).toEqual(['scope']);
  });
});

describe('a behaviour read strictly', () => {
  it('takes each runtime behaviour within its range', () => {
    expect(readBehaviour({ kind: 'parallax', amount: 0.3, axis: 'y' }).ok).toBe(true);
    expect(readBehaviour({ kind: 'marquee', amount: 60, axis: 'x', reverse: true }).ok).toBe(true);
    expect(issuesOf(readBehaviour({ kind: 'parallax', amount: 3 }))).toEqual(['amount']);
    expect(issuesOf(readBehaviour({ kind: 'sticky', amount: 0 }))).toEqual(['kind']);
  });
});
