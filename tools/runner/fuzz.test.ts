// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableCSSFileLoading":true,"handleDisabledFileLoadingAsSuccess":true,"disableJavaScriptFileLoading":true}}
// The silent-failure fuzz (jornada03 J1: a command's result the model refuses was dropped with nothing said). Every
// command that takes a text, through each of its doors, on every fixture and on several kinds of selected element,
// with texts a person might type (empty, spaces, numbers, units, colours, tokens, markup, scripts, long text, broken
// syntax): the editor's own store, frozen as in development, throws InvalidStateError on a breach, and any throw is a
// defect. A run must change the document into one the model takes, change nothing, or be refused with words.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { InvalidStateError } from '../../src/core/store/store.ts';
import { walk, type DocumentJson } from '../../src/core/document/model.ts';
import { manualClock } from '../../src/core/ports/clock.ts';
import { sequentialIds } from '../../src/core/ports/ids.ts';
import { isFeatureBuilt } from '../../src/app/features.ts';
import { createEditorStore } from '../../src/editor/store.ts';
import type { CommandId, FeatureId } from '../../src/generated/ids.ts';
import { manifest } from '../../src/manifest/runtime.ts';

// what a browser hands or what replaces the whole project: proven by the browser runner, not here
// (style.setGridTracks: the track a value goes to is the field's own place in the list)
const SKIPPED = new Set(['style.setGridTracks', 'project.restoreVersion', 'files.saveContent', 'element.applyHtml', 'style.applyCssRule', 'workspace.setActiveTab', 'workspace.resizeSplitter', 'workspace.movePanel', 'colorPicker.setChannel', 'assetPicker.open', 'handle.step', 'field.scrub', 'grid.spanItem']);
// the arguments that name something the project holds (a door always hands an existing one): filled with what the
// fixture holds, never fuzzed
const REFERENCES: Readonly<Record<string, (document: DocumentJson, target: string) => readonly string[]>> = {
  token: (d) => (d.tokens ?? []).map((t) => t.name),
  className: (d) => (d.classes ?? []).map((c) => c.name),
  component: (d) => (d.components ?? []).map((c) => c.name),
  animation: (d, target) => [...walk(d.pages[0]?.tree ?? ({ children: [] } as never))].find((n) => n.id === target)?.animations?.map((a) => a.name) ?? [],
  guide: () => [],
  section: () => [],
  row: () => [],
  group: () => [],
  version: () => [],
};
// the arguments a person types
const TYPED = new Set(['value', 'name', 'nextName', 'href', 'markup', 'html', 'css', 'declarations', 'content', 'query', 'id', 'easing', 'type', 'tag']);
const TEXTS = ['', '   ', '0', '12', '-4', '1e9', '12px', '50%', 'auto', 'none', '#fff', 'red', 'var(--line)', 'var(--nope)', 'calc(100% - 8px)', 'calc(', '}', '<b>x</b>', 'javascript:alert(1)', 'img/graos.png', 'Título com acentos ção', 'a'.repeat(300), 'a b', '--x', '0px 0px'];

interface CommandShape {
  readonly id: string;
  readonly args: Record<string, { readonly type: string; readonly values: readonly string[]; readonly optional: boolean }>;
  readonly entryPoints: readonly { readonly args: Record<string, unknown>; readonly feature: string }[];
}
const COMMANDS = (manifest.commands as unknown as readonly CommandShape[]).filter((c) => !SKIPPED.has(c.id) && Object.values(c.args).some((a) => a.type === 'string'));

const FIXTURES = fs
  .readdirSync('manifest/features/fixtures')
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f.replace(/\.json$/u, ''), document: JSON.parse(fs.readFileSync(path.join('manifest/features/fixtures', f), 'utf8')) as DocumentJson }));

// several kinds of element per fixture: the root, the first of each element type the page holds
function picks(document: DocumentJson): readonly string[] {
  const page = document.pages[0];
  if (page === undefined) return [];
  const seen = new Set<string>();
  const chosen: string[] = [];
  for (const node of walk(page.tree)) {
    if (seen.has(node.type)) continue;
    seen.add(node.type);
    chosen.push(node.id);
  }
  return chosen;
}

const memory = (): { read(): string | null; write(text: string): void } => {
  let held: string | null = null;
  return { read: () => held, write: (text) => void (held = text) };
};

describe('the silent-failure fuzz', () => {
  for (const fixture of FIXTURES) {
    it(`never breaks the model nor throws, on ${fixture.name}`, () => {
      const broken: string[] = [];
      for (const target of picks(fixture.document)) {
        const store = createEditorStore({
          storage: memory(),
          workspace: memory(),
          clock: manualClock(1_000_000),
          ids: sequentialIds('f'),
          restored: { document: fixture.document, selection: [] },
          ports: { readOnly: () => false },
          freeze: true,
        });
        const dispatch = store.dispatch as unknown as (id: CommandId, args: unknown) => { status: string };
        dispatch('selection.select' as CommandId, { target });
        for (const command of COMMANDS) {
          const doors = command.entryPoints.filter((d) => isFeatureBuilt(d.feature as FeatureId)).slice(0, 6);
          const textArgs = Object.entries(command.args).filter(([, a]) => a.type === 'string').map(([name]) => name);
          for (const door of doors) {
            // a door whose control composes an argument the person does not type (a measured size, a property the
            // field stands for) hands it itself: such a door is the browser runner's
            const composed = Object.entries(command.args).some(([name, arg]) => !arg.optional && arg.type !== 'node' && (door.args[name] === undefined || (door.args[name] === '' && !TYPED.has(name))) && !TYPED.has(name) && REFERENCES[name] === undefined);
            if (composed) continue;
            for (const text of TEXTS) {
              const args: Record<string, unknown> = { ...door.args };
              let unnamed = false;
              for (const name of textArgs) {
                if (args[name] !== undefined && args[name] !== '') continue;
                const named = REFERENCES[name];
                if (named === undefined && TYPED.has(name)) args[name] = text;
                else if (named === undefined) continue;
                else {
                  const held = named(store.getState().document, target)[0];
                  if (held === undefined) unnamed = true;
                  else args[name] = held;
                }
              }
              if (unnamed) continue;
              for (const [name, arg] of Object.entries(command.args)) if (args[name] === undefined && arg.type === 'node') args[name] = target;
              const before = store.getState().history.past.length;
              try {
                const result = dispatch(command.id as CommandId, args);
                if (result.status === 'confirm') store.answer(false);
              } catch (error) {
                broken.push(`${command.id} ${JSON.stringify(args).slice(0, 120)} on ${target}: ${error instanceof InvalidStateError ? error.message : String(error)}`);
              }
              // keep the fixture as it was for the next run
              while (store.getState().history.past.length > before) dispatch('history.undo' as CommandId, {});
              if (store.getState().selection[0] !== target) dispatch('selection.select' as CommandId, { target });
            }
          }
        }
      }
      if (broken.length > 0) fs.appendFileSync(path.join('.cache/logs', 'fuzz-broken.txt'), `${broken.map((b) => `${fixture.name} ${b}`).join('\n')}\n`);
      expect([...new Set(broken.map((b) => b.split(' ')[0]))], broken.slice(0, 12).join(' | ')).toEqual([]);
    }, 600_000);
  }
});
