import test from 'node:test';
import assert from 'node:assert/strict';
import { score, percentiles } from './metrics.mjs';

test('invalid counters cannot manufacture a cheaper task', () => {
  for (const click of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '2']) assert.throws(() => score({ gestures: { click } }));
});
test('an absent gesture record is unknown, never a zero-cost success', () => {
  assert.throws(() => score({ result: 'done' }));
});
test('invalid timing samples are rejected instead of filtered out', () => {
  assert.throws(() => percentiles([1, 2, Number.NaN]));
});
