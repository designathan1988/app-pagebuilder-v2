// npm run inventory:check: the inventory and the feature table on disk are what the generator writes now. It reads
// before it writes (a hand edit is reported, never erased), and it fails on the two things the inventory exists to
// catch:
//
//   - a built feature whose commands no module registers (the feature claims to be built; nothing implements it);
//   - a module registering commands of a feature that is not built (code for a feature the app does not offer yet).
import fs from 'node:fs';
import path from 'node:path';
import { loadManifest, REPO_ROOT } from '../manifest/load.ts';
import { generate, inventoryJson, inventoryMarkdown, INVENTORY_JSON, INVENTORY_MD } from './generate.ts';
import { featuresMarkdown, FEATURES_MD } from './features.ts';

const expected = generate();
const wantedJson = inventoryJson(expected);
const wantedMd = inventoryMarkdown(expected);
const wantedFeatures = featuresMarkdown(expected);
const at = (file: string) => path.join(REPO_ROOT, file);
const read = (file: string) => (fs.existsSync(at(file)) ? fs.readFileSync(at(file), 'utf8') : '');
const heldJson = read(INVENTORY_JSON);
const heldMd = read(INVENTORY_MD);
const heldFeatures = read(FEATURES_MD);

const problems: string[] = [];
if (heldJson !== wantedJson) problems.push(`${INVENTORY_JSON} differs from what the generator writes (run npm run inventory)`);
if (heldMd !== wantedMd) problems.push(`${INVENTORY_MD} differs from what the generator writes (run npm run inventory)`);
if (heldFeatures !== wantedFeatures) problems.push(`${FEATURES_MD} differs from what the generator writes (run npm run inventory)`);

// a built feature whose commands nothing registers: code that does not exist behind a door that says it does
for (const feature of expected.features) {
  if (!feature.built || feature.commands.length === 0) continue;
  const registering = expected.modules.filter((module) => module.commands.some((id) => feature.commands.includes(id)));
  if (registering.length === 0) problems.push(`feature "${feature.id}" is built but no module registers its commands (${feature.commands.slice(0, 3).join(', ')}${feature.commands.length > 3 ? ', …' : ''})`);
}
// a module registering a command of a feature that is not built: an implementation the app cannot reach
for (const feature of expected.features) {
  if (feature.built) continue;
  for (const module of expected.modules) {
    if (module.features.includes(feature.id) && module.commands.length > 0) {
      problems.push(`module "${module.path}" registers commands of "${feature.id}", which is not built`);
    }
  }
}
// The owner a command names is the module that registers it: the manifest says where a command belongs and the source
// says where it is. (This replaces the rule that compared the manifest with a table written by hand in a document: the
// answer is in the code, so it is read there.)
const moduleOf = new Map<string, string>();
for (const module of expected.modules) for (const id of module.commands) if (!moduleOf.has(id)) moduleOf.set(id, module.path);
const loaded = loadManifest();
const declaredOwners = Object.entries(loaded.input.files)
  .filter(([file]) => file.startsWith('commands/'))
  .flatMap(([, data]) => (Array.isArray((data as { commands?: unknown }).commands) ? ((data as { commands: { id: string; owner: string }[] }).commands) : []));
for (const command of declaredOwners) {
  const actual = moduleOf.get(command.id);
  if (actual === undefined) continue; // not registered yet: the reference check owns that
  if (command.owner !== actual) problems.push(`${command.id} says it belongs to ${command.owner}, but ${actual} registers it`);
}

// A feature that is not built has no code that runs: for a feature without commands of its own, its code is the module
// its tooth proof names (manifest toothProof), and no source may import that module while the feature is not built
// (the audit's AUD-17: hover-measure drew its sizes and distances while the contract said "not available yet").
const importsOf = (file: string): string[] => {
  const text = fs.readFileSync(at(file), 'utf8');
  return [...text.matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)].map((match) => path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1] ?? '')));
};
const sources = expected.modules.map((module) => module.path);
const toothModules = Object.entries(loaded.input.files)
  .filter(([file]) => file.startsWith('features/'))
  .flatMap(([, data]) => ((data as { features?: { id: string; toothProof?: string }[] }).features ?? []).flatMap((feature) => (feature.toothProof === undefined ? [] : [[feature.id, feature.toothProof] as const])));
for (const [id, module] of toothModules) {
  if (expected.features.find((feature) => feature.id === id)?.built !== false) continue;
  const importers = sources.filter((file) => importsOf(file).includes(module));
  if (importers.length > 0) problems.push(`feature "${id}" is not built, but its code ${module} runs: ${importers.join(', ')} import${importers.length === 1 ? 's' : ''} it`);
}

if (problems.length === 0) {
  console.log(`inventory:check: ${expected.totals.features} features, ${expected.totals.commands} commands, ${expected.totals.modules} modules — the files match and every built feature has its code.`);
  process.exit(0);
}
for (const problem of problems) console.error(`✗ ${problem}`);
console.error(`inventory:check FAILED: ${problems.length} problem(s)`);
process.exit(1);
