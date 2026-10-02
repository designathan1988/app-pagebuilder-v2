import { describe, expect, it } from 'vitest';
import { boxCorners, boxSides, type ValueFacts } from './codecs.ts';

const facts: ValueFacts = { units: ['px', '%', 'rem'], keywords: ['auto'], defaultUnit: 'px' };

describe('box composite input', () => {
  for (const codec of [boxCorners, boxSides]) {
    it(`${codec.id} accepts bare lengths and expands one through four values`, () => {
      for (const [input, values] of [
        ['12', ['12px', '12px', '12px', '12px']],
        ['14 28', ['14px', '28px', '14px', '28px']],
        ['10 20 30', ['10px', '20px', '30px', '20px']],
        ['10 20 30 40', ['10px', '20px', '30px', '40px']],
        ['1.5rem 20%', ['1.5rem', '20%', '1.5rem', '20%']],
        ['-2 .5', ['-2px', '0.5px', '-2px', '0.5px']],
      ] as const) expect(codec.read(input, facts)).toMatchObject({ kind: 'longhands', values });
    });
    it(`${codec.id} shares length arithmetic and preserves explicit functions`, () => {
      expect(codec.read('16*2 8', facts)).toMatchObject({ values: ['32px', '8px', '32px', '8px'] });
      expect(codec.read('calc(100% - 20px)', facts)).toMatchObject({ values: Array(4).fill('calc(100% - 20px)') });
      expect(codec.read('2', { ...facts, defaultUnit: 'rem' })).toMatchObject({ values: Array(4).fill('2rem') });
      for (const input of ['', '1 2 3 4 5', '2bogus', 'Infinity', 'calc(1px', '1/0']) expect(codec.read(input, facts)).toBeNull();
    });
  }
  it('keeps color composites in their own value domain', () => {
    expect(boxSides.read('red #123456', { units: [], keywords: [], defaultUnit: '' })).toMatchObject({ values: ['red', '#123456', 'red', '#123456'] });
  });
});
