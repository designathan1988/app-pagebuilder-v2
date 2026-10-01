import { expect, it } from 'vitest';
import { summarize, budgetResult } from './metrics.ts';

it('keeps the study percentile convention and never treats absent samples as zero', () => {
  expect(summarize([])).toEqual({ n: 0, p50: null, p95: null, max: null });
  expect(summarize([10, 40, 20, 30])).toEqual({ n: 4, p50: 30, p95: 40, max: 40 });
  expect(budgetResult(summarize([]), { p50: 35, p95: 100 })).toBe('missing');
});

it('computes the tail over all samples instead of averaging the percentiles of unequal runs', () => {
  expect(summarize([...Array<number>(99).fill(10), 500])).toEqual({ n: 100, p50: 10, p95: 10, max: 500 });
  expect(budgetResult(summarize([10, 20, 40, 150]), { p50: 35, p95: 100 })).toBe('exceeded');
  expect(budgetResult(summarize([10, 20, 30]), { p50: 35, p95: 100 })).toBe('within');
});

it('refuses invalid timing samples rather than silently improving the report', () => {
  expect(() => summarize([1, Number.NaN])).toThrow();
  expect(() => summarize([-1, 20])).toThrow();
});
