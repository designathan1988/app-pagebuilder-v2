// The authoring data of removable modules (authoring.ts): inert JSON the module that wrote it validates while it is
// installed, kept and accepted as it is once it is not.
import { describe, expect, it } from 'vitest';
import { authoringProblems, registerAuthoringValidator } from './authoring.ts';

describe('authoring data (core/document/authoring.ts)', () => {
  it('accepts any JSON of a namespace no installed module claims: a removed module\'s document still opens', () => {
    expect(authoringProblems({ 'gone-module': { role: 'container', intent: { regions: [] } } })).toEqual([]);
  });

  it('refuses what is not JSON and an empty record', () => {
    expect(authoringProblems({})).toEqual([{ path: '', message: 'authoring is an object with at least one namespace, or absent' }]);
    expect(authoringProblems({ module: Number.NaN })).toEqual([{ path: '/module', message: 'an authoring namespace holds JSON' }]);
    expect(authoringProblems([])).toHaveLength(1);
  });

  it('asks the installed module whether it can read its own namespace, and stops asking once it is removed', () => {
    const remove = registerAuthoringValidator('probe', (value) => (typeof value === 'object' && value !== null && 'role' in value ? null : 'a probe record has a role'));
    expect(authoringProblems({ probe: { role: 'x' } })).toEqual([]);
    expect(authoringProblems({ probe: { kind: 'x' } })).toEqual([{ path: '/probe', message: 'a probe record has a role' }]);
    remove();
    expect(authoringProblems({ probe: { kind: 'x' } })).toEqual([]);
  });
});
