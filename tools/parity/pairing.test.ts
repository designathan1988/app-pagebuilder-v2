// docs/PAIRING.md is the writer's own (tools/parity/report.ts), from docs/pairing.json and the recorded decisions,
// never edited by hand; and every decision it names is one docs/PRODUCT.md records.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOCUMENT, pairingDocument, readDecisions, readPairs } from './report.ts';

describe('the pairing document', () => {
  it('is what the writer makes of the last pairing and the decisions', () => {
    expect(fs.readFileSync(DOCUMENT, 'utf8')).toBe(pairingDocument(readPairs(), readDecisions()));
  });

  it('names only decisions docs/PRODUCT.md records', () => {
    const product = fs.readFileSync('docs/PRODUCT.md', 'utf8');
    expect(readDecisions().map((one) => one.decision).filter((id) => !product.includes(`| ${id} |`))).toEqual([]);
  });
});
