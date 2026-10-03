// npm run journey [-- <task> …]: the jornada03 tasks replayed in Chrome (tools/journey/journey.config.ts), each task
// by its code — M1…M5, D1…D4, C1…C5, P2…P4, H2 (the fidelity of Marina's saved project, H2 and H3) — or all of them
// with none named; then the scoreboard (tools/journey/scoreboard.ts). The complete output goes to
// .cache/logs/journey/run.txt.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tasks = process.argv.slice(2);
// (Playwright matches a grep against the test's whole title path, its file's name first: a code is a word of it)
const grep = tasks.length === 0 ? [] : ['--grep', `\\b(${tasks.map((code) => code.replace(/[^A-Za-z0-9]/g, '')).join('|')})\\b`];
const out = path.join('.cache', 'logs', 'journey');
fs.mkdirSync(out, { recursive: true });
// Playwright's own command line, run by this Node without a shell (a shell would read the grep's | and ^)
const run = spawnSync(process.execPath, [path.join('node_modules', '@playwright', 'test', 'cli.js'), 'test', '-c', 'tools/journey/journey.config.ts', ...grep], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(out, 'run.txt'), `${run.stdout ?? ''}${run.stderr ?? ''}`);
console.log((run.stdout ?? '').split('\n').filter((line) => /passed|failed|✘|✓|ok \d|x \d/.test(line)).join('\n'));
const board = spawnSync(process.execPath, [path.join('tools', 'journey', 'scoreboard.ts')], { encoding: 'utf8' });
console.log(board.stdout);
process.exitCode = run.status ?? 1;
