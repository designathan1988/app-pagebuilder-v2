// @vitest-environment happy-dom
// Every refusal an availability predicate can say is one its command declares (the audit's AUD-08: nine style commands
// shared editableSelection without declaring status.locked.byAncestor, and the store threw before anything was said).
// Each predicate with words of its own is asked, for every command that names it, over fixtures and selections — none,
// each element, a locked element and one inside it, the page root — and every refusal key it gives must be the
// command's declared refusal key or one of its refusals.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PREDICATES } from '../../src/app/commands.ts';
import { walk, type DocNode, type DocumentJson } from '../../src/core/document/model.ts';
import type { StoreState } from '../../src/core/store/store.ts';
import { initialEditorUi, type EditorUi } from '../../src/editor/state.ts';
import { INITIAL_PREFERENCES } from '../../src/editor/preferences/preferences.ts';
import { MODEL_RULES } from '../../src/editor/store.ts';
import { manifest } from '../../src/manifest/runtime.ts';

const FIXTURES = ['aurora', 'catalog', 'content-site-shared', 'form-controls', 'motion'];

// the fixture with one element locked (the first child of the first page's first child), so a lock and a lock above an
// element are both asked about
function withLock(document: DocumentJson): { readonly document: DocumentJson; readonly locked: string | null; readonly inside: string | null } {
  const page = document.pages[0];
  const holder = page?.tree.children.find((child) => child.children.length > 0);
  if (page === undefined || holder === undefined) return { document, locked: null, inside: null };
  const lock = (node: DocNode): DocNode => (node.id === holder.id ? { ...node, locked: true } : { ...node, children: node.children.map(lock) });
  return { document: { ...document, pages: [{ ...page, tree: lock(page.tree) }, ...document.pages.slice(1)] }, locked: holder.id, inside: holder.children[0]?.id ?? null };
}

describe('the refusals of the availability predicates', () => {
  it('are declared by every command that names them', () => {
    const ui: EditorUi = initialEditorUi(INITIAL_PREFERENCES);
    const undeclared = new Set<string>();
    for (const name of FIXTURES) {
      const { document, locked, inside } = withLock(JSON.parse(fs.readFileSync(`manifest/features/fixtures/${name}.json`, 'utf8')) as DocumentJson);
      const ids = document.pages.flatMap((page) => [...walk(page.tree)].map((node) => node.id)).slice(0, 40);
      const selections = [[], ...ids.map((id) => [id]), ...(locked === null ? [] : [[locked]]), ...(inside === null ? [] : [[inside]]), ids.slice(0, 2)];
      for (const command of manifest.commands) {
        const predicate = PREDICATES[command.availability.predicate as keyof typeof PREDICATES] as { test: (s: StoreState<EditorUi>, r: typeof MODEL_RULES, a?: unknown) => boolean; refusal?: (s: StoreState<EditorUi>, r: typeof MODEL_RULES, a?: unknown) => { key: string } } | undefined;
        if (predicate?.refusal === undefined) continue;
        const declared = new Set<string>([command.availability.refusalKey ?? '', ...command.refusals]);
        for (const selection of selections) {
          const state = { document, selection, history: { past: [], future: [] }, message: null, ui } as unknown as StoreState<EditorUi>;
          let key: string | null = null;
          try {
            if (!predicate.test(state, MODEL_RULES, {})) key = predicate.refusal(state, MODEL_RULES, {}).key;
          } catch {
            // a predicate asked with arguments its doors always hand (a target, a property) is not asked here
            continue;
          }
          if (key !== null && !declared.has(key)) undeclared.add(`${command.id} (${command.availability.predicate}): ${key}`);
        }
      }
    }
    expect([...undeclared].sort()).toEqual([]);
  });
});
