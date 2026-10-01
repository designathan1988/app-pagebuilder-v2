import { describe, expect, it } from 'vitest';
import { affectedPlan, type AffectedInput, type FeatureModules } from './affected-plan.ts';

const owner: FeatureModules = { id: 'wrap-row-column', built: true, modules: ['src/core/structure/wrap.ts'] };
const plan = (changed: readonly string[], reaches: ReadonlyMap<string, ReadonlySet<string>> = new Map(changed.map((file) => [file, new Set([file])])), features: readonly FeatureModules[] = [owner]) => affectedPlan({
  changed, reaches, features, changedFeatures: new Set(), availableSpecs: new Set(['tests/e2e/wrap-row-column.spec.ts', 'tests/e2e/app-menu.spec.ts']),
} satisfies AffectedInput);

describe('affected browser test selection', () => {
  for (const file of ['src/editor/input/keymap.ts', 'src/editor/input/pointer.ts', 'src/core/store/store.ts', 'src/editor/store.ts', 'src/editor/doors/door.tsx']) {
    it(`runs every browser test when shared ${file} changes even if a feature owns it`, () => {
      const result = plan([file], undefined, [{ id: 'keyboard-panel-navigation', built: true, modules: [file] }]);
      // No grep and no file filter: list grammar and all other door consumers must execute too.
      expect(result.runs).toEqual([[]]);
    });
  }

  it('includes all door consumers when a pointer helper reaches the shared pointer owner', () => {
    const file = 'src/editor/input/pointer/views.ts';
    expect(plan([file], new Map([[file, new Set([file, 'src/editor/input/pointer.ts'])]]), [{ id: 'layers-tree', built: true, modules: [file] }]).runs).toEqual([[]]);
  });

  it('does not mistake the command registration boundary for runtime fan-out of a narrow handler', () => {
    const file = 'src/core/structure/wrap.ts';
    const result = plan([file], new Map([[file, new Set([file, 'src/app/commands.ts'])]]));
    expect(result.runs).toEqual([
      ['scenarios.spec', '--grep', '@feature:wrap-row-column(?![\\w-])'],
      ['tests/e2e/wrap-row-column.spec.ts'],
    ]);
  });

  for (const file of ['src/editor/shell/unknown.tsx', 'src/editor/shell/window.css', 'src/i18n/locales/en.json', 'src/editor/deleted.ts']) {
    it(`falls back to the full suite for unmapped production ${file}`, () => {
      expect(plan([file, 'src/core/structure/wrap.ts']).runs).toEqual([[]]);
    });
  }

  it('does not count an unbuilt feature as test coverage for a production module', () => {
    const file = 'src/editor/new-panel.ts';
    expect(plan([file], undefined, [{ id: 'unbuilt-panel', built: false, modules: [file] }]).runs).toEqual([[]]);
  });

  it('normalizes Windows paths before deciding runtime reach', () => {
    expect(plan(['src\\editor\\input\\keymap.ts']).runs).toEqual([[]]);
  });

  it('runs only an explicitly changed browser spec when no runtime changed', () => {
    expect(plan(['tests/e2e/app-menu.spec.ts']).runs).toEqual([['tests/e2e/app-menu.spec.ts']]);
  });

  it('does not spend a browser run on docs, unit tests or declaration files alone', () => {
    expect(plan(['docs/QA-LOG.md', 'src/core/store/store.test.ts', 'src/types.d.ts']).runs).toEqual([]);
  });

  for (const file of ['src/generated/ids.ts', 'src/generated/commands.ts']) {
    it(`does not exempt generated runtime values in ${file} merely because the file also exports types`, () => {
      expect(plan([file]).runs).toEqual([[]]);
    });
  }

  it('keeps full coverage for the common runner and manifest infrastructure', () => {
    expect(plan(['tools/runner/scenarios.ts']).runs).toEqual([[]]);
    expect(plan(['manifest/interactions.json']).runs).toEqual([[]]);
  });
});
