import { describe, expect, it } from 'vitest';
import type { MotionTimeline, TimelineAction } from './model.ts';
import {
  actionEnd,
  addMarker,
  clampActionDelta,
  clampKeyframeDelta,
  copyKeyframes,
  deleteKeyframes,
  editKeyframe,
  moveActions,
  moveKeyframes,
  moveMarker,
  pasteKeyframes,
  placementStart,
  resizeAction,
  setKeyframeAt,
  timelineDuration,
  withDuration,
} from './timeline.ts';

const animate = (id: string, start: number, duration: number, keyframes: readonly [number, string][] = [[0, '0'], [duration, '1']]): TimelineAction => ({
  id,
  target: { kind: 'self' },
  start,
  duration,
  effect: { kind: 'animate', tracks: [{ id: `${id}-opacity`, property: 'opacity', keyframes: keyframes.map(([time, value], index) => ({ id: `${id}-k${index}`, time, value })) }] },
});
const instant = (id: string, start: number): TimelineAction => ({ id, target: { kind: 'self' }, start, duration: 0, effect: { kind: 'class', operation: 'add', className: 'is-on' } });
const timeline = (actions: TimelineAction[], markers: MotionTimeline['markers'] = []): MotionTimeline => ({ id: 't', name: 'T', actions, markers });
const keyframesOf = (one: MotionTimeline, action: string): readonly (readonly [number, string])[] => {
  const found = one.actions.find((each) => each.id === action);
  if (found === undefined || found.effect.kind !== 'animate') return [];
  return found.effect.tracks[0]?.keyframes.map((keyframe) => [keyframe.time, keyframe.value] as const) ?? [];
};
let counter = 0;
const id = () => `new-${(counter += 1)}`;

describe('sequence and parallel', () => {
  it('places a new action after everything (sequence), with the last one (parallel) or at the playhead', () => {
    const one = timeline([animate('a', 0, 600), animate('b', 200, 1000)]);
    expect(placementStart(one, 'after', 0)).toBe(1200);
    expect(placementStart(one, 'with', 0)).toBe(200);
    expect(placementStart(one, 'at', 750.4)).toBe(750);
    expect(placementStart(timeline([]), 'after', 0)).toBe(0);
  });

  it('counts the repeats of an action in its end, an infinite one as one cycle, the markers in the length', () => {
    expect(actionEnd({ ...animate('a', 100, 400), repeat: 3 })).toBe(1300);
    expect(actionEnd({ ...animate('a', 100, 400), repeat: 'infinite' })).toBe(500);
    expect(timelineDuration(timeline([animate('a', 0, 600)], [{ id: 'm', name: 'M', time: 2000 }]))).toBe(2000);
  });
});

describe('bars', () => {
  it('moves a group by one shared delta, none before 0', () => {
    const one = timeline([animate('a', 100, 600), animate('b', 500, 600), animate('c', 900, 600)]);
    expect(clampActionDelta(one, new Set(['a', 'b']), -300)).toBe(-100);
    const moved = moveActions(one, new Set(['a', 'b']), -300);
    expect(moved.actions.map((each) => each.start)).toEqual([0, 400, 900]);
    expect(moveActions(one, new Set(['b']), 250).actions.map((each) => each.start)).toEqual([100, 750, 900]);
  });

  it('resizes from the end, keyframes scaled with the duration', () => {
    const one = timeline([animate('a', 100, 600, [[0, '0'], [300, '0.5'], [600, '1']])]);
    const longer = resizeAction(one, 'a', 'end', 600, 10);
    expect(longer.actions[0]?.duration).toBe(1200);
    expect(keyframesOf(longer, 'a')).toEqual([[0, '0'], [600, '0.5'], [1200, '1']]);
  });

  it('resizes from the start, the end staying where it was, never shorter than the minimum', () => {
    const one = timeline([animate('a', 100, 600)]);
    const later = resizeAction(one, 'a', 'start', 200, 10);
    expect([later.actions[0]?.start, later.actions[0]?.duration]).toEqual([300, 400]);
    const squeezed = resizeAction(one, 'a', 'start', 5000, 10);
    expect([squeezed.actions[0]?.start, squeezed.actions[0]?.duration]).toEqual([690, 10]);
    const earlier = resizeAction(one, 'a', 'start', -500, 10);
    expect([earlier.actions[0]?.start, earlier.actions[0]?.duration]).toEqual([0, 700]);
  });

  it('leaves an instant action without a length to change', () => {
    const one = timeline([instant('i', 300)]);
    expect(resizeAction(one, 'i', 'end', 200, 10)).toEqual(one);
  });

  it('keeps the later of two keyframes a scale puts on the same ms', () => {
    const scaled = withDuration(animate('a', 0, 600, [[0, '0'], [1, 'x'], [600, '1']]), 2);
    expect(scaled.effect.kind === 'animate' ? scaled.effect.tracks[0]?.keyframes.map((keyframe) => [keyframe.time, keyframe.value]) : []).toEqual([[0, 'x'], [2, '1']]);
  });
});

describe('keyframes', () => {
  it('adds a keyframe in time order, or replaces the one at that time, a new property making its track', () => {
    let action = animate('a', 0, 600);
    action = setKeyframeAt(action, 'opacity', 300, '0.4', 'ease-in', id);
    action = setKeyframeAt(action, 'opacity', 600, '0.9', undefined, id);
    action = setKeyframeAt(action, 'translate-y', 0, '1em', undefined, id);
    expect(action.effect.kind === 'animate' ? action.effect.tracks.map((track) => [track.property, track.keyframes.map((keyframe) => [keyframe.time, keyframe.value, keyframe.easing ?? null])]) : null).toEqual([
      ['opacity', [[0, '0', null], [300, '0.4', 'ease-in'], [600, '0.9', null]]],
      ['translate-y', [[0, '1em', null]]],
    ]);
  });

  it('moves keyframes together, never out of their action nor past a keyframe that stays', () => {
    const one = timeline([animate('a', 0, 1000, [[0, '0'], [400, '0.5'], [1000, '1']])]);
    const middle = { action: 'a', track: 'a-opacity', keyframe: 'a-k1' };
    expect(clampKeyframeDelta(one, [middle], 2000)).toBe(599);
    expect(clampKeyframeDelta(one, [middle], -2000)).toBe(-399);
    expect(keyframesOf(moveKeyframes(one, [middle], 100), 'a')).toEqual([[0, '0'], [500, '0.5'], [1000, '1']]);
    const last = { action: 'a', track: 'a-opacity', keyframe: 'a-k2' };
    expect(clampKeyframeDelta(one, [middle, last], 50)).toBe(0);
  });

  it('edits a value, an easing (null removes it) and a time between its neighbours', () => {
    const one = timeline([animate('a', 0, 1000, [[0, '0'], [400, '0.5'], [1000, '1']])]);
    const ref = { action: 'a', track: 'a-opacity', keyframe: 'a-k1' };
    const eased = editKeyframe(one, ref, { value: '0.6', easing: 'steps(2)' });
    expect(eased.actions[0]?.effect.kind === 'animate' ? eased.actions[0].effect.tracks[0]?.keyframes[1] : null).toEqual({ id: 'a-k1', time: 400, value: '0.6', easing: 'steps(2)' });
    const plain = editKeyframe(eased, ref, { easing: null, time: 5000 });
    expect(plain.actions[0]?.effect.kind === 'animate' ? plain.actions[0].effect.tracks[0]?.keyframes[1] : null).toEqual({ id: 'a-k1', time: 999, value: '0.6' });
  });

  it('deletes keyframes, a track left empty going with them', () => {
    const one = timeline([animate('a', 0, 600)]);
    const remaining = deleteKeyframes(one, [{ action: 'a', track: 'a-opacity', keyframe: 'a-k0' }]);
    expect(keyframesOf(remaining, 'a')).toEqual([[600, '1']]);
    const empty = deleteKeyframes(remaining, [{ action: 'a', track: 'a-opacity', keyframe: 'a-k1' }]);
    expect(empty.actions[0]?.effect).toEqual({ kind: 'animate', tracks: [] });
  });

  it('copies keyframes with their spacing and pastes them at a time, the action growing to hold them', () => {
    const one = timeline([animate('a', 200, 600, [[0, '0'], [300, '0.5'], [600, '1']])]);
    const copied = copyKeyframes(one, [{ action: 'a', track: 'a-opacity', keyframe: 'a-k2' }, { action: 'a', track: 'a-opacity', keyframe: 'a-k1' }]);
    expect(copied).toEqual([{ property: 'opacity', offset: 0, value: '0.5' }, { property: 'opacity', offset: 300, value: '1' }]);
    const pasted = pasteKeyframes(one, 'a', 800, copied, id);
    expect(pasted?.actions[0]?.duration).toBe(900);
    expect(pasted === null ? [] : keyframesOf(pasted, 'a')).toEqual([[0, '0'], [300, '0.5'], [600, '0.5'], [900, '1']]);
    // never before the action's start
    expect(pasteKeyframes(one, 'a', 100, copied, id)).toBeNull();
  });
});

describe('markers', () => {
  it('keeps markers in time order, moved never before 0', () => {
    let one = addMarker(timeline([]), { id: 'm2', name: 'B', time: 900 });
    one = addMarker(one, { id: 'm1', name: 'A', time: 300 });
    expect(one.markers.map((marker) => marker.id)).toEqual(['m1', 'm2']);
    expect(moveMarker(one, 'm2', -2000).markers.map((marker) => [marker.id, marker.time])).toEqual([['m2', 0], ['m1', 300]]);
  });
});
