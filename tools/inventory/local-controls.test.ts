// Every control the editor draws outside the manifest is declared there, with its reason (the audit's AUD-33: eleven
// controls marked data-local, an exception no document or check named): a name drawn and not declared in
// manifest/layout.json `localControls` fails, as does one declared and drawn nowhere.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DRAWN = /data-local="([a-z0-9-]+)"/gu;

function sources(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(folder, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sources(at);
    return /\.(ts|tsx)$/u.test(entry.name) && !/\.test\.tsx?$/u.test(entry.name) ? [at] : [];
  });
}

describe('the controls that are no door', () => {
  it('are each declared in the manifest with their reason, and each drawn', () => {
    const drawn = new Set(sources('src').flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(DRAWN)].map((match) => match[1] ?? '')));
    const layout = JSON.parse(fs.readFileSync('manifest/layout.json', 'utf8')) as { localControls: { id: string; reason: string }[] };
    const declared = new Set(layout.localControls.map((control) => control.id));
    expect([...drawn].filter((id) => !declared.has(id)).sort(), 'drawn and not declared').toEqual([]);
    expect([...declared].filter((id) => !drawn.has(id)).sort(), 'declared and drawn nowhere').toEqual([]);
  });
});
