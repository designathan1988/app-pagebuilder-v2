// Pure selection policy used by the affected runner. Returned arguments are the actual Playwright invocations.
export interface FeatureModules {
  readonly id: string;
  readonly built: boolean;
  readonly modules: readonly string[];
}

export interface AffectedInput {
  readonly changed: readonly string[];
  readonly reaches: ReadonlyMap<string, ReadonlySet<string>>;
  readonly features: readonly FeatureModules[];
  readonly changedFeatures: ReadonlySet<string>;
  readonly availableSpecs: ReadonlySet<string>;
}

const EVERYTHING = [/^tests\/support\//, /^tests\/e2e\/door\.ts$/, /^tools\/runner\/scenarios\.ts$/, /^playwright\.config\.ts$/, /^manifest\/(commands\/|layout\.json|interactions\.json|properties\.json|elements\.json|environment\.json)/, /^package(-lock)?\.json$/, /^vite\.config\.ts$/, /^index\.html$/, /^src\/main\.tsx$/];
// Door consumers do not import these owners: they reach them through real input and dispatch. An inventory edge
// to one feature is therefore not the complete set of affected features. The command registration boundary is
// deliberately absent: reaching it from a narrow handler does not mean its other handlers changed.
const SHARED_RUNTIME = new Set(['src/editor/input/keymap.ts', 'src/editor/input/pointer.ts', 'src/core/store/store.ts', 'src/editor/store.ts', 'src/editor/doors/door.tsx']);
const normalized = (file: string): string => file.replaceAll('\\', '/');
export const productionSource = (file: string): boolean => file.startsWith('src/') && !/\.(?:test|d)\.tsx?$/.test(file);

export function affectedPlan(input: AffectedInput) {
  const changed = input.changed.map(normalized);
  const reaches = new Map([...input.reaches].map(([file, reached]) => [normalized(file), new Set([...reached].map(normalized))]));
  const reached = new Set([...reaches.values()].flatMap((set) => [...set]));
  const modules = new Set(input.features.filter((feature) => feature.built).flatMap((feature) => feature.modules.map(normalized)));
  const unmapped = changed.filter(productionSource).filter((file) => ![...(reaches.get(file) ?? new Set([file]))].some((one) => modules.has(one)));
  const features = input.features.filter((feature) => feature.built && (input.changedFeatures.has(feature.id) || feature.modules.some((module) => reached.has(normalized(module))))).map((feature) => feature.id);
  const specs = [...new Set([
    ...features.map((id) => `tests/e2e/${id}.spec.ts`).filter((file) => input.availableSpecs.has(file)),
    ...changed.filter((file) => /^tests\/e2e\/.*\.spec\.ts$/.test(file) && input.availableSpecs.has(file)),
  ])];
  const reasons = [
    ...changed.filter((file) => EVERYTHING.some((pattern) => pattern.test(file))),
    ...[...SHARED_RUNTIME].filter((file) => reached.has(file) || changed.includes(file)).map((file) => `shared door runtime: ${file}`),
    ...unmapped.map((file) => `unmapped production source: ${file}`),
  ];
  const runs: string[][] = reasons.length > 0 ? [[]] : [
    ...(features.length > 0 ? [['scenarios.spec', '--grep', features.map((id) => `@feature:${id}(?![\\w-])`).join('|')]] : []),
    ...(specs.length > 0 ? [specs] : []),
  ];
  return { reasons, features, specs, unmapped, runs };
}
