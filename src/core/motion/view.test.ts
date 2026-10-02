import { describe, expect, it } from 'vitest';
import type { MotionTimeline } from './model.ts';
import { lanes, readout, seconds, snapTargets, snapTime, snappedDelta, ticks, timeToX, xToTime, zoomAt } from './view.ts';

const view = { pixelsPerSecond: 200, scroll: 0 };
const timeline: MotionTimeline = {
  id: 't',
  name: 'T',
  markers: [{ id: 'm', name: 'Peak', time: 1500 }],
  actions: [
    { id: 'a', target: { kind: 'self' }, start: 0, duration: 600, effect: { kind: 'animate', tracks: [{ id: 'k', property: 'opacity', keyframes: [{ id: 'f1', time: 0, value: '0' }, { id: 'f2', time: 600, value: '1', easing: 'ease-in' }] }] } },
    { id: 'b', target: { kind: 'self' }, start: 800, duration: 0, effect: { kind: 'class', operation: 'add', className: 'on' } },
    { id: 'c', target: { kind: 'children' }, start: 200, duration: 400, effect: { kind: 'animate', tracks: [{ id: 'k2', property: 'translate-y', keyframes: [{ id: 'f3', time: 0, value: '1em' }] }] } },
  ],
};

describe('the seconds axis', () => {
  it('turns ms into px and back at the zoom and scroll', () => {
    expect(timeToX(view, 1500)).toBe(300);
    expect(xToTime(view, 300)).toBe(1500);
    expect(timeToX({ pixelsPerSecond: 100, scroll: 1000 }, 1500)).toBe(50);
    expect(xToTime(view, -40)).toBe(0);
  });

  it('zooms about a point that keeps its time, within the limits', () => {
    const zoomed = zoomAt(view, 2, 300, { min: 20, max: 4000 });
    expect(zoomed.pixelsPerSecond).toBe(400);
    expect(xToTime(zoomed, 300)).toBe(1500);
    expect(zoomAt(view, 1000, 0, { min: 20, max: 4000 }).pixelsPerSecond).toBe(4000);
  });

  it('labels the ruler with the smallest step that keeps the labels apart', () => {
    const marks = ticks(view, 1200, 72);
    const labels = marks.filter((tick) => tick.major).map((tick) => tick.label);
    expect(labels.slice(0, 4)).toEqual(['0', '0.5', '1', '1.5']);
    expect(marks.filter((tick) => !tick.major).length).toBeGreaterThan(0);
    expect(ticks({ pixelsPerSecond: 40, scroll: 0 }, 400, 72).filter((tick) => tick.major).map((tick) => tick.label)).toEqual(['0', '2', '4', '6', '8', '10']);
  });

  it('writes the readout with two decimals, seconds with no trailing zeros', () => {
    expect(readout(480, timeline)).toEqual({ time: '0.48', duration: '1.50' });
    expect(seconds(1200)).toBe('1.2');
    expect(seconds(3000)).toBe('3');
  });
});

describe('snapping', () => {
  it('snaps to the nearest edge, keyframe, marker or the playhead within the tolerance, else to the grid', () => {
    const targets = snapTargets(timeline, 1000);
    expect(snapTime(1495, targets, view, 6, 50)).toEqual({ time: 1500, to: { time: 1500, kind: 'marker' } });
    expect(snapTime(1010, targets, view, 6, 50).to?.kind).toBe('playhead');
    expect(snapTime(1260, targets, view, 6, 50)).toEqual({ time: 1250, to: { time: 1250, kind: 'grid' } });
    expect(snapTime(1263, targets, view, 0, 0)).toEqual({ time: 1263, to: null });
  });

  it('leaves out what is dragged, so a bar never snaps to its own edges', () => {
    const targets = snapTargets(timeline, 0, { actions: new Set(['b']) });
    expect(targets.some((target) => target.time === 800)).toBe(false);
    // a dragged group follows its leading edge
    expect(snappedDelta(800, 695, snapTargets(timeline, 0, { actions: new Set(['b']) }), view, 6, 50)).toEqual({ delta: 700, to: { time: 1500, kind: 'marker' } });
  });
});

describe('the lanes', () => {
  it('draws one lane per target with its bars, then one per property its animations key', () => {
    const rows = lanes(timeline);
    expect(rows.map((row) => (row.kind === 'target' ? `target ${row.target.kind} ${row.actions.map((one) => one.id).join(',')}` : `property ${row.property} ${row.keyframes.map((one) => one.time).join(',')}`))).toEqual([
      'target self a,b',
      'property opacity 0,600',
      'target children c',
      'property translate-y 200',
    ]);
    const opacity = rows[1];
    expect(opacity?.kind === 'property' ? opacity.keyframes[1]?.easing : null).toBe('ease-in');
  });
});
