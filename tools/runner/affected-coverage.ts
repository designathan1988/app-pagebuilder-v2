// The tests a change reaches, read from what each test executed (plan G6, R4): the last coverage run (npm run
// e2e:coverage, a complete run with E2E_COVERAGE on a clean tree) recorded, per test, the source lines its scripts ran
// and the selectors its stylesheets used (tests/support/coverage.ts). A change to a script reaches the tests that ran
// one of its changed lines; a change to a stylesheet, the tests that used one of its changed rules' selectors, and the
// photos (visual.spec). The lines are the coverage run's own: the change is read against the commit it ran on.
// Anything it cannot place (a file it never saw, a data file, a change outside src/) is the caller's to decide.
import { parse as parseCss, walk as walkCss, generate as generateCss } from 'css-tree';

export interface Recorded {
  readonly test: string;
  readonly lines: Readonly<Record<string, readonly (readonly [number, number])[]>>;
  readonly selectors: readonly string[];
}

// the old side's changed lines of a unified diff with no context (git diff -U0), by file: a removal or a change its
// lines, an insertion the line it follows and the next
export function changedLines(diff: string): ReadonlyMap<string, readonly (readonly [number, number])[]> {
  const out = new Map<string, [number, number][]>();
  let file: string | null = null;
  for (const line of diff.split('\n')) {
    const header = /^--- (?:a\/(.+)|\/dev\/null)$/.exec(line);
    if (header !== null) {
      file = header[1] ?? null;
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(line);
    if (hunk === null || file === null) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const held = out.get(file) ?? [];
    held.push(count === 0 ? [start, start + 1] : [start, start + count - 1]);
    out.set(file, held);
  }
  return out;
}

// the selectors of the rules of a stylesheet's text that stand on one of the given lines, as the coverage writes them
export function selectorsOn(css: string, lines: readonly (readonly [number, number])[]): ReadonlySet<string> {
  const found = new Set<string>();
  let ast;
  try {
    ast = parseCss(css, { positions: true });
  } catch {
    return found;
  }
  walkCss(ast, (node) => {
    if (node.type !== 'Rule' || node.loc === null || node.loc === undefined) return;
    const from = node.loc.start.line;
    const to = node.loc.end.line;
    if (!lines.some(([a, b]) => a <= to && b >= from)) return;
    for (const one of generateCss(node.prelude).split(',')) found.add(one.replace(/\s+/g, ' ').trim());
  });
  return found;
}

const meets = (ran: readonly (readonly [number, number])[] | undefined, changed: readonly (readonly [number, number])[]): boolean =>
  ran !== undefined && ran.some(([a, b]) => changed.some(([c, d]) => a <= d && b >= c));

// The tests that ran a changed line of a script or used a changed rule's selector.
export function testsReached(records: readonly Recorded[], scripts: ReadonlyMap<string, readonly (readonly [number, number])[]>, selectors: ReadonlySet<string>): readonly string[] {
  // one selector however it was spaced: css-tree writes `.c>.d`, Chrome's coverage `.c > .d`
  const normal = (one: string) => one.replace(/\s*([>+~])\s*/g, '$1').replace(/\s+/g, ' ').trim();
  const wanted = new Set([...selectors].map(normal));
  return records
    .filter((record) => [...scripts].some(([file, changed]) => meets(record.lines[file], changed)) || record.selectors.some((one) => wanted.has(normal(one))))
    .map((record) => record.test);
}
