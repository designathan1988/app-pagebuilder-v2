// The inventory (the plan's "a generated inventory of everything"): what the application is made of, derived from the
// manifest and the source — never hand-written, so it cannot go stale. One command, three files:
//
//   docs/inventory.json   the machine's copy: every feature, command, door, module and their links
//   docs/INVENTORY.md     the person's copy: the same facts as tables
//   docs/FEATURES.md      the state of every feature (tools/inventory/features.ts): the manifest, the source, the
//                         behaviour spec and the last complete browser run, joined
//
// It answers, without reading the code: which feature owns which commands and doors, which module registers them
// (the owner of a concept is the module that registers its commands — the hand-written table this replaces), how many
// scenarios each feature carries, how big each module is, and which modules register nothing (the ones to look at
// when asking whether something is unused).
import fs from 'node:fs';
import path from 'node:path';
import { isRegistered } from '../../src/core/commands/registry.ts';
import { FEATURES } from '../../src/app/features.ts';
import { loadManifest, registrationsIn, REPO_ROOT } from '../manifest/load.ts';
import { featuresMarkdown, FEATURES_MD } from './features.ts';

// The machine's copy sits beside the person's: the manifest's own folders accept only the files its contract names,
// and this one is derived from the manifest and the source together (the manifest's checker refused it there).
export const INVENTORY_JSON = path.join('docs', 'inventory.json');
export const INVENTORY_MD = path.join('docs', 'INVENTORY.md');

interface FeatureRow {
  readonly id: string;
  readonly built: boolean;
  readonly commands: readonly string[];
  readonly doors: number;
  readonly scenarios: number;
  readonly modules: readonly string[];
}
interface ModuleRow {
  readonly path: string;
  readonly lines: number;
  readonly commands: readonly string[];
  readonly features: readonly string[];
}
export interface Inventory {
  readonly totals: {
    readonly features: number;
    readonly built: number;
    readonly commands: number;
    readonly doors: number;
    readonly scenarios: number;
    readonly modules: number;
    readonly lines: number;
  };
  readonly features: readonly FeatureRow[];
  readonly modules: readonly ModuleRow[];
}

// every .ts/.tsx under src/, its line count, and the ids it registers
function sourceModules(): { path: string; lines: number; registers: readonly string[] }[] {
  const out: { path: string; lines: number; registers: readonly string[] }[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
        out.push({ path: rel, lines: text.split('\n').length, registers: registrationsIn(text).filter((one) => one.kind === 'handler').map((one) => one.id) });
      }
    }
  };
  walk('src');
  return out;
}

export function generate(): Inventory {
  const loaded = loadManifest();
  const modules = sourceModules();
  const moduleOf = new Map<string, string>();
  for (const module of modules) for (const id of module.registers) if (!moduleOf.has(id)) moduleOf.set(id, module.path);

  // the manifest's own files: commands (with their doors) and features (with their commands and scenarios)
  const commandFiles = Object.entries(loaded.input.files).filter(([file]) => file.startsWith('commands/'));
  const commands = commandFiles.flatMap(([, data]) => {
    const list = (data as { commands?: unknown } | null)?.commands;
    return Array.isArray(list) ? (list as { id: string; entryPoints: readonly { id: string }[] }[]) : [];
  });
  const commandById = new Map(commands.map((command) => [command.id, command]));
  const featureFiles = Object.entries(loaded.input.files).filter(([file]) => file.startsWith('features/'));
  const features = featureFiles.flatMap(([, data]) => {
    const list = (data as { features?: unknown } | null)?.features;
    return Array.isArray(list) ? (list as { id: string; commands: readonly string[]; scenarios: readonly unknown[] }[]) : [];
  });
  const featureRows: FeatureRow[] = [];
  for (const feature of features) {
    const modules = new Set<string>();
    for (const id of feature.commands) {
      const module = moduleOf.get(id);
      if (module !== undefined) modules.add(module);
    }
    const doors = feature.commands.reduce((sum, id) => sum + (commandById.get(id)?.entryPoints.length ?? 0), 0);
    featureRows.push({
      id: feature.id,
      built: isRegistered(FEATURES[feature.id as keyof typeof FEATURES] ?? { id: feature.id }),
      commands: [...feature.commands],
      doors,
      scenarios: feature.scenarios.length,
      modules: [...modules].sort(),
    });
  }

  const featuresOfModule = new Map<string, string[]>();
  for (const feature of featureRows) for (const module of feature.modules) featuresOfModule.set(module, [...(featuresOfModule.get(module) ?? []), feature.id]);
  const moduleRows: ModuleRow[] = modules
    .map((module) => ({ path: module.path, lines: module.lines, commands: module.registers, features: (featuresOfModule.get(module.path) ?? []).sort() }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const totals = {
    features: featureRows.length,
    built: featureRows.filter((one) => one.built).length,
    commands: commands.length,
    doors: commands.reduce((sum, command) => sum + command.entryPoints.length, 0),
    scenarios: featureRows.reduce((sum, one) => sum + one.scenarios, 0),
    modules: moduleRows.length,
    lines: moduleRows.reduce((sum, one) => sum + one.lines, 0),
  };
  return { totals, features: featureRows, modules: moduleRows };
}

// The machine's copy: stable key order and two-space JSON, so the same tree writes the same bytes.
export function inventoryJson(inventory: Inventory): string {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

// The person's copy: the totals, one row per feature, then the largest modules and the ones that register nothing.
export function inventoryMarkdown(inventory: Inventory): string {
  const lines: string[] = [];
  lines.push('# Inventory', '');
  lines.push('Generated by `npm run inventory` (tools/inventory/generate.ts) from the manifest and the source: never');
  lines.push('edited by hand. `npm run inventory:check` fails while this file and the manifest are out of step.', '');
  const t = inventory.totals;
  lines.push(`${t.features} features (${t.built} built), ${t.commands} commands, ${t.doors} doors, ${t.scenarios} scenarios, ${t.modules} modules, ${t.lines} lines.`, '');
  lines.push('## Features', '');
  lines.push('| Feature | Built | Commands | Doors | Scenarios | Modules |');
  lines.push('|---|---|---|---|---|---|');
  for (const feature of inventory.features) {
    lines.push(`| \`${feature.id}\` | ${feature.built ? 'yes' : 'not yet'} | ${feature.commands.length} | ${feature.doors} | ${feature.scenarios} | ${feature.modules.map((one) => `\`${one}\``).join(' ')} |`);
  }
  lines.push('', '## The largest modules', '', 'A size is a signal to look, never a rule: a file is split by responsibility, and a split that would');
  lines.push('fragment one thing is rejected with its reason.', '');
  lines.push('| Module | Lines | Commands it registers |');
  lines.push('|---|---|---|');
  for (const module of [...inventory.modules].sort((a, b) => b.lines - a.lines).slice(0, 15)) {
    lines.push(`| \`${module.path}\` | ${module.lines} | ${module.commands.length} |`);
  }
  const silent = inventory.modules.filter((one) => one.commands.length === 0);
  lines.push('', `## Modules registering no command (${silent.length})`, '', 'Most are owners of something a command reads (a renderer, a port, a rule). A module here that nothing');
  lines.push('imports either is a candidate to delete.', '');
  for (const module of silent.slice(0, 40)) lines.push(`- \`${module.path}\``);
  if (silent.length > 40) lines.push(`- … and ${silent.length - 40} more`);
  lines.push('');
  return lines.join('\n');
}

export function writeInventory(): { json: string; md: string; features: string } {
  const inventory = generate();
  return { json: inventoryJson(inventory), md: inventoryMarkdown(inventory), features: featuresMarkdown(inventory) };
}

if (process.argv[1]?.endsWith('generate.ts') === true) {
  const { json, md, features } = writeInventory();
  fs.writeFileSync(path.join(REPO_ROOT, INVENTORY_JSON), json);
  fs.writeFileSync(path.join(REPO_ROOT, INVENTORY_MD), md);
  fs.writeFileSync(path.join(REPO_ROOT, FEATURES_MD), features);
  console.log(`inventory: wrote ${INVENTORY_JSON}, ${INVENTORY_MD} and ${FEATURES_MD}`);
}
