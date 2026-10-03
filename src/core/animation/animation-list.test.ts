// AN3: an element's several animations are written as CSS lists in one rule (each wrote its own set, the last won).
import { describe, expect, it } from 'vitest';
import { animationListDeclarations, defaultSettings } from './animation.ts';

const one = (name: string, duration: string) => ({ name, settings: { ...defaultSettings(), duration }, keyframes: [] });

describe('the animations of one element in one rule (AN3)', () => {
  it('lists each property in the animations order, one animation as before', () => {
    const two = animationListDeclarations([one('a', '1.2s'), one('b', '0.8s')]);
    expect(two[0]).toBe('animation-name: a, b;');
    expect(two).toContain('animation-duration: 1.2s, 0.8s;');
    expect(two.filter((line) => line.startsWith('animation-name'))).toHaveLength(1);
    expect(animationListDeclarations([one('a', '1s')])[0]).toBe('animation-name: a;');
  });
});
