// npm run e2e:coverage — the complete browser suite with E2E_COVERAGE=1 (plan G6, R4): every test records what it
// executed (tests/support/coverage.ts) into .cache/coverage/tests, and .cache/coverage/meta.json names the commit it
// ran on, which npm run e2e:affected reads changes against. It runs on a clean tree (the lines must be the commit's);
// arguments after it go to Playwright. It is the complete run of the end of the work, with the coverage recorded.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' })
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.endsWith('.claude/launch.json'));
if (dirty.length > 0) {
  console.log(`the coverage is recorded on a clean tree; commit or put aside first:\n${dirty.join('\n')}`);
  process.exit(2);
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dir = path.join('.cache', 'coverage');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const cli = path.join('node_modules', '@playwright', 'test', 'cli.js');
const status = spawnSync(process.execPath, [cli, 'test', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, E2E_COVERAGE: '1' } }).status ?? 1;
fs.writeFileSync(path.join(dir, 'meta.json'), `${JSON.stringify({ commit, at: new Date().toISOString(), status }, null, 2)}\n`);
const recorded = fs.existsSync(path.join(dir, 'tests')) ? fs.readdirSync(path.join(dir, 'tests')).length : 0;
console.log(`coverage of ${commit.slice(0, 7)} written to ${dir} (${recorded} tests)`);
process.exit(status);
