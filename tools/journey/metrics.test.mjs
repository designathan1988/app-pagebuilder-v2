import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compare, expertRate, percentiles, pointerCount, score } from './metrics.mjs';

test('movement is excluded from pointer actions and key chords retain the study cost', () => {
  assert.equal(pointerCount({ click: 3, dblclick: 1, drag: 1, wheel: 2, move: 90, keys: 10 }), 7);
  assert.equal(score({ gestures: { click: 12, keys: 57 }, historyAtStart: { undoSteps: 0 }, historyAtEnd: { undoSteps: 4 } }).klmSeconds, 31.6);
});
test('percentiles preserve the original study index convention and missing samples', () => {
  assert.deepEqual(percentiles([]), { n: 0, p50: null, p95: null, max: null });
  assert.deepEqual(percentiles([1, 2, 3, 4]), { n: 4, p50: 3, p95: 4, max: 4 });
});
test('a missing history remains unknown, and subjective values are never fabricated', () => {
  const row = score({ gestures: {} });
  assert.equal(row.committed, null); assert.equal(row.seq, null); assert.equal(row.efficiency, null);
});
test('zero reference metrics require exact agreement; missing latency does not pass', () => {
  const result = compare({ gestures: {}, incidents: 1 }, { gestures: {}, incidents: 0 });
  assert.equal(result.rows.find((r) => r.name === 'incidents').withinTolerance, false);
  assert.equal(result.rows.find((r) => r.name === 'latencyP95').withinTolerance, null);
  assert.equal(result.allComparableWithinTolerance, false);
});
test('invalid expert runs cannot improve the floor', () => {
  const rate = expertRate([{ id: 'invalid', result: 'invalid', historyAtEnd: { undoSteps: 1000 }, gestures: {} },
    { id: 'valid', result: 'done', historyAtStart: { undoSteps: 0 }, historyAtEnd: { undoSteps: 2 }, gestures: { click: 4, keys: 10 } }]);
  assert.deepEqual(rate, { pointer: 2, keys: 5, commits: 2, runs: ['valid'] });
});
test('every archived Journey 03 scoreboard row is recomputed from raw records unchanged', () => {
  const folder = path.resolve('jornada03/data');
  const read = (name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
  const rate = expertRate(fs.readdirSync(folder).filter((name) => /^expert-.*\.json$/.test(name)).map(read));
  const expected = read('scoreboard.json');
  assert.deepEqual(rate, expected.method.expertRate);
  for (const row of expected.rows) assert.deepEqual(score(read(`${row.id}.json`), rate), row, row.id);
});
