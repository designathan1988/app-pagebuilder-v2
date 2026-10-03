// Every finding of the jornada03 study is reproduced by a test (STG-0.2; jornada03/REPORT.md, J1–J28): the map
// tests/e2e/jornada03.json names, for each J, the tests that replay its path and assert the fix — a browser test, a
// scenario of the manifest, a unit test or the performance gate. A J the map leaves out, or a test it names that does
// not exist (renamed, removed), fails here.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

type Proof = { readonly spec: string; readonly test: string } | { readonly scenario: string } | { readonly unit: string; readonly test: string } | { readonly perf: string };
const MAP = JSON.parse(fs.readFileSync('tests/e2e/jornada03.json', 'utf8')) as { findings: Record<string, readonly Proof[]> };
const FINDINGS = Array.from({ length: 28 }, (_, i) => `J${i + 1}`);

const SCENARIOS = new Set(
  fs
    .readdirSync('manifest/features')
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => (JSON.parse(fs.readFileSync(`manifest/features/${file}`, 'utf8')) as { features?: { id: string; scenarios: { id: string }[] }[] }).features ?? [])
    .flatMap((feature) => feature.scenarios.map((scenario) => `${feature.id} › ${scenario.id}`)),
);
// a test's title as its file writes it, the call that opens it in front: test('…', it('…', or a template's start
const titled = (file: string, title: string): boolean => {
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, 'utf8');
  return [`test('${title}`, `it('${title}`, `test(\`${title}`, `it(\`${title}`].some((opening) => text.includes(opening));
};
const exists = (proof: Proof): boolean => {
  if ('scenario' in proof) return SCENARIOS.has(proof.scenario);
  if ('perf' in proof) return fs.existsSync(proof.perf);
  if ('spec' in proof) return titled(`tests/e2e/${proof.spec}`, proof.test);
  return titled(proof.unit, proof.test);
};

describe('the jornada03 findings', () => {
  it('are each reproduced by at least one test', () => {
    expect(FINDINGS.filter((id) => (MAP.findings[id] ?? []).length === 0), 'findings no test reproduces').toEqual([]);
    expect(Object.keys(MAP.findings).filter((id) => !FINDINGS.includes(id)), 'entries that are no finding').toEqual([]);
  });

  it('name tests that exist', () => {
    const missing = Object.entries(MAP.findings).flatMap(([id, proofs]) => proofs.filter((proof) => !exists(proof)).map((proof) => `${id}: ${JSON.stringify(proof)}`));
    expect(missing, 'named and not found').toEqual([]);
  });
});
