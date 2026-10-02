// The Keyboard shortcuts panel (spec shortcuts-panel): Help › Keyboard shortcuts opens it as a tab of the bottom dock
// (closed by default, opened by its first tab), and the panel lists every binding the keymap holds, grouped by the
// context it acts in, with the manifest's own keys and the command's label — a list generated from the keymap, so what
// the manifest declares is exactly what is drawn.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test.ts';
import { openEditor } from '../support/editor.ts';
import { isFeatureBuilt } from '../../src/app/features.ts';
import { chordCap } from '../../src/editor/input/key-caps.ts';
import type { FeatureId } from '../../src/generated/ids.ts';
import { runDoor, runs } from './door.ts';

const HELP = 'workspace.setPanelOpen#menu-help-shortcuts';
const TAB = 'workspace.setActiveTab#tab-strip-tab';

interface Command {
  readonly id: string;
  readonly entryPoints: readonly { readonly id: string; readonly kind: string; readonly chord?: string; readonly context?: string; readonly labelKey: string; readonly feature: string }[];
}
const COMMANDS: readonly Command[] = fs
  .readdirSync('manifest/commands')
  .flatMap((file) => (JSON.parse(fs.readFileSync(path.join('manifest/commands', file), 'utf8')) as { commands: Command[] }).commands);
const SHORTCUTS = COMMANDS.flatMap((command) => command.entryPoints.filter((door) => door.kind === 'shortcut').map((door) => ({ ref: `${command.id}#${door.id}`, chord: door.chord ?? '', context: door.context ?? '', labelKey: door.labelKey, feature: door.feature })));
const EN = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8')) as Record<string, string>;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
});

test('Help › Keyboard shortcuts opens the panel as a dock tab, listing every binding of the keymap by context', runs(HELP, TAB), async ({ page }) => {
  // the workbench is closed at the start (its strip alone: spec workspace, a closed dock keeps its strip): the panel
  // opens the dock with its first tab
  await expect(page.locator('.dock [role="tabpanel"]')).toHaveCount(0);
  await runDoor(page, HELP);
  await expect(page.locator('.dock [role="tab"][aria-selected="true"]')).toHaveText('Keyboard shortcuts');
  const panel = page.locator('[data-region="shortcuts"]');
  await expect(panel).toBeVisible();
  // every binding the manifest declares is listed, with its keys and what it does, and nothing else
  const rows = await panel.locator('[data-shortcut]').evaluateAll((els) =>
    els.map((el) => ({ ref: el.getAttribute('data-shortcut') ?? '', text: (el.textContent ?? '').trim() })),
  );
  expect(rows.map((row) => row.ref).sort()).toEqual(SHORTCUTS.map((binding) => binding.ref).sort());
  for (const binding of SHORTCUTS) {
    const row = rows.find((one) => one.ref === binding.ref);
    const label = EN[binding.labelKey] ?? '';
    // a label with a placeholder is listed with the word the panel fills in for it
    const expected = label.replace('{element}', EN['palette.tile'] ?? '');
    expect(row?.text, binding.ref).toContain(expected === '' ? binding.labelKey : expected);
    // the keys as their caps show them (Alt+↑ for Alt+ArrowUp: keymap.ts chordCap)
    expect(row?.text, binding.ref).toContain(chordCap(binding.chord));
  }
  // the groups are the contexts of interactions.json, in its order, each with the count of its bindings
  const contexts = (JSON.parse(fs.readFileSync('manifest/interactions.json', 'utf8')) as { keyContexts: { id: string; labelKey: string }[] }).keyContexts;
  // the raw text: the titles draw uppercase (a style), the catalogue holds the words
  const groupLabels = await panel.locator('.shortcuts__title').evaluateAll((els) => els.map((el) => el.textContent ?? ''));
  const expectedGroups = contexts
    .map((context) => ({ label: EN[context.labelKey] ?? '', count: SHORTCUTS.filter((binding) => binding.context === context.id).length }))
    .filter((group) => group.count > 0)
    .map((group) => `${group.label} (${group.count})`);
  expect(groupLabels).toEqual(expectedGroups);
  // a binding whose command the editor has not built yet is marked as not available, a built one is not: the marked
  // rows are exactly the bindings of the features the registry has not built (every keyed feature is built now, so
  // the list is empty — and a keyed feature that waits again is marked, which is what this pair proves)
  const marked = await panel.locator('[data-shortcut] .shortcuts__reason').evaluateAll((els) => els.map((el) => el.closest('[data-shortcut]')?.getAttribute('data-shortcut') ?? ''));
  const waiting = SHORTCUTS.filter((binding) => !isFeatureBuilt(binding.feature as FeatureId)).map((binding) => binding.ref);
  expect(marked.sort()).toEqual(waiting.sort());
  expect(marked).not.toContain('history.undo#key-ctrl-z-in-global');
  // and the tab closes with the dock's own close button
  await page.locator('[data-door="workspace.setPanelOpen#workbench-tab-close"][data-args*="shortcuts"]').click();
  await expect(page.locator('[data-region="shortcuts"]')).toHaveCount(0);
});
