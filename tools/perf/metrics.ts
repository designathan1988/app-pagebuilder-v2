// Same percentile index convention as Journey 03; aggregate raw samples, never run percentiles.
export interface Summary { readonly n: number; readonly p50: number | null; readonly p95: number | null; readonly max: number | null }
export function summarize(samples: readonly number[]): Summary {
  if (samples.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid timing sample');
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? null;
  return { n: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? null };
}
export function budgetResult(actual: Summary, target: { readonly p50: number; readonly p95: number }): 'missing' | 'within' | 'exceeded' {
  if (actual.p50 === null || actual.p95 === null) return 'missing';
  return actual.p50 <= target.p50 && actual.p95 <= target.p95 ? 'within' : 'exceeded';
}

export interface Sample {
  readonly phase: string;
  readonly event: string;
  readonly key: string | null;
  readonly trusted: boolean;
  readonly inputMs: number;
  readonly handlerMs: number;
  readonly inputDelayMs: number;
  readonly parentRealm: boolean;
  readonly originOffsetMs: number;
}
export interface PerformanceRun {
  readonly iteration: number;
  readonly nodes: number;
  readonly openingMs: number;
  readonly samples: readonly Sample[];
  readonly eventTiming: readonly { readonly name: string; readonly duration: number; readonly interactionId: number }[];
  readonly screenshot: string;
}
