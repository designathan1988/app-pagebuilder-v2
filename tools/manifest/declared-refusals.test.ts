// Every refusal a command declares is one some code says (RF1, found while AUD-35 wrote refusal scenarios: five keys
// were declared and catalogued that nothing said — formInForm and labelOneControl, which the content model's exclusions
// replaced with notInside; readOnlyTab, never the read-only tab's words; two of canvas.setEditMode, which refuses
// nothing). Said is: the key written whole in the source of src/ (tests and generated files aside) or in a manifest
// rule file, the start of a key the source builds (`status.breakpoints.${…}`), or a command's availability key, which
// the store says when its predicate has no words of its own. And the content model's words go together: a command
// that declares one of them can be refused by every one its rules say (src/core/elements/content-model.ts).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface Command {
  readonly id: string;
  readonly availability: { readonly refusalKey: string | null };
  readonly refusals: readonly string[];
}

function sources(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(folder, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sources(at);
    return /\.(ts|tsx)$/u.test(entry.name) && !/\.test\.tsx?$/u.test(entry.name) ? [at] : [];
  });
}

const COMMANDS: readonly Command[] = fs
  .readdirSync('manifest/commands')
  .filter((file) => file.endsWith('.json'))
  .flatMap((file) => (JSON.parse(fs.readFileSync(`manifest/commands/${file}`, 'utf8')) as { commands?: Command[] }).commands ?? []);
const SOURCE = sources('src').map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const RULES = ['properties', 'elements', 'interactions', 'checks', 'layout'].map((name) => fs.readFileSync(`manifest/${name}.json`, 'utf8')).join('\n');
// the starts of the keys the source builds from a template: `status.breakpoints.${refused}`
const BUILT = [...SOURCE.matchAll(/`((?:status|refusal)\.[\w.]+\.)\$\{/gu)].map((match) => match[1] ?? '');
const AVAILABILITY = new Set(COMMANDS.flatMap((command) => (command.availability.refusalKey === null ? [] : [command.availability.refusalKey])));
const said = (key: string): boolean =>
  [`'${key}'`, `"${key}"`, `\`${key}\``].some((quoted) => SOURCE.includes(quoted)) || RULES.includes(`"${key}"`) || BUILT.some((start) => key.startsWith(start)) || AVAILABILITY.has(key);

// the words the content model's rules say (content-model.ts), every one of them by any rule that places elements
const CONTENT_MODEL = ['status.refused.onlyAccepts', 'status.refused.interactiveInside', 'status.refused.notInside'];

describe('the refusals the commands declare', () => {
  it('are each said by some code', () => {
    const unsaid = COMMANDS.flatMap((command) => command.refusals.filter((key) => !said(key)).map((key) => `${command.id}: ${key}`));
    expect(unsaid, 'declared and said by nothing').toEqual([]);
  });

  it('hold every word of the content model once they hold one', () => {
    const partial = COMMANDS.flatMap((command) => {
      if (!command.refusals.some((key) => CONTENT_MODEL.includes(key))) return [];
      const missing = CONTENT_MODEL.filter((key) => !command.refusals.includes(key));
      return missing.length === 0 ? [] : [`${command.id}: ${missing.join(', ')}`];
    });
    expect(partial, 'commands that declare part of the content model').toEqual([]);
  });
});
