/* global process, console */
// Offline scoring only. The browser recorder remains deferred until the product stages are complete.
import fs from 'node:fs';
import path from 'node:path';
import { expertRate, score } from './metrics.mjs';

const directory = process.argv[2] ?? 'jornada03/data';
const records = fs.readdirSync(directory).filter((name) => /^expert-.*\.json$/.test(name)).map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
const rate = expertRate(records);
const archived = JSON.parse(fs.readFileSync(path.join(directory, 'scoreboard.json'), 'utf8'));
const rows = archived.rows.map((expected) => {
  const actual = score(JSON.parse(fs.readFileSync(path.join(directory, `${expected.id}.json`), 'utf8')), rate);
  return { id: expected.id, differences: Object.keys(expected).filter((key) => actual[key] !== expected[key]).map((key) => ({ key, expected: expected[key], actual: actual[key] })) };
});
const result = { kind: 'offline formula equivalence, not a live browser replay', rate, rows, matches: rows.every((row) => row.differences.length === 0) };
console.log(JSON.stringify(result, null, 2));
if (!result.matches) process.exitCode = 2;
