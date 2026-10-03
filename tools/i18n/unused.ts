// The keys of the English catalogue no code, manifest, tool or test names (the audit's M-06: 43 keys nobody read, the
// words of surfaces that were never drawn). A key counts as named when it stands as a token in a source, its plural
// stem does (a key's .one / .other forms), or a template or a concatenation builds it from one of its prefixes
// (`canvas.drop.${where}`, 'interactions.trigger.' + id). src/generated is left out: it lists every key. The sources
// are read once into two sets, so the check stays quick.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';

const ROOTS = ['src', 'manifest', 'tools', 'tests'];
const SKIPPED = normalize('src/generated');
const CATALOGUES = new Set(['en.json', 'pt-BR.json']);
const PLURAL = /\.(zero|one|two|few|many|other)$/;
// a dotted name, as a key is written
const TOKEN = /[A-Za-z][\w-]*(?:\.[\w-]+)+/g;
// a prefix a template or a concatenation completes: `a.b.${x}` or 'a.b.' + x
const BUILT = /([A-Za-z][\w-]*(?:\.[\w-]+)*\.)(?:\$\{|['"`]\s*\+)/g;

function sources(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (normalize(path).startsWith(SKIPPED)) continue;
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx|json|mjs)$/.test(name) && !CATALOGUES.has(name)) out.push(readFileSync(path, 'utf8'));
  }
  return out;
}

export interface Named {
  readonly tokens: ReadonlySet<string>;
  readonly prefixes: ReadonlySet<string>;
}

export function namedIn(text: string): Named {
  return { tokens: new Set(text.match(TOKEN) ?? []), prefixes: new Set([...text.matchAll(BUILT)].map((m) => m[1] ?? '')) };
}

export function unusedKeys(keys: readonly string[], named: Named): string[] {
  return keys.filter((key) => {
    const stem = key.replace(PLURAL, '');
    if (named.tokens.has(key) || named.tokens.has(stem)) return false;
    const parts = stem.split('.');
    for (let cut = parts.length - 1; cut > 0; cut -= 1) if (named.prefixes.has(`${parts.slice(0, cut).join('.')}.`)) return false;
    return true;
  });
}

export function projectText(): string {
  return ROOTS.flatMap((root) => sources(root, [])).join('\n');
}
