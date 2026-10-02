import { describe, expect, it } from 'vitest';
import { createEasing } from './easing.ts';

const easing = createEasing();
const parsed = (text: string) => {
  const one = easing.parse(text);
  if (one === null) throw new Error(`${text} reads as no easing`);
  return one;
};

describe('the one reader of an easing', () => {
  it('reads the CSS keywords, cubic-bezier, steps and linear() into their canonical text', () => {
    expect(parsed('  Ease-Out ').text).toBe('ease-out');
    expect(parsed('cubic-bezier(0.34,1.560, 0.64 , 1)').text).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
    expect(parsed('steps(4)').text).toBe('steps(4, jump-end)');
    expect(parsed('steps(3, start)').text).toBe('steps(3, jump-start)');
    expect(parsed('step-end').steps).toEqual({ count: 1, position: 'jump-end' });
    expect(parsed('linear(0, 0.25 40%, 1)').text).toBe('linear(0 0%, 0.25 40%, 1 100%)');
    // the inputs a linear() leaves out are spread between their neighbours
    expect(parsed('linear(0, 0.5, 0.75, 1)').stops?.map(([, input]) => Number(input.toFixed(4)))).toEqual([0, 0.3333, 0.6667, 1]);
  });

  it('refuses what CSS refuses: an x outside 0 to 1, steps of nothing, a jump-none of one step, an unknown word', () => {
    for (const text of ['cubic-bezier(1.2, 0, 0, 1)', 'cubic-bezier(0, 0, 1)', 'steps(0)', 'steps(1, jump-none)', 'steps(2, sideways)', 'linear(1)', 'bounce', 'spring(1, 0, 10)', '']) {
      expect(easing.parse(text), text).toBeNull();
    }
  });

  it('samples a curve: the keywords and Bézier curves by x, steps by their jumps', () => {
    expect(easing.sample(parsed('linear'), 0.3)).toBeCloseTo(0.3, 5);
    expect(easing.sample(parsed('ease-in'), 0.5)).toBeLessThan(0.5);
    expect(easing.sample(parsed('ease-out'), 0.5)).toBeGreaterThan(0.5);
    expect(easing.sample(parsed('cubic-bezier(0.34, 1.56, 0.64, 1)'), 0.6)).toBeGreaterThan(1);
    // steps(4, jump-end): 0, .25, .5, .75 then 1 at the end
    expect([0, 0.2, 0.26, 0.99, 1].map((x) => easing.sample(parsed('steps(4)'), x))).toEqual([0, 0, 0.25, 0.75, 1]);
    // jump-start jumps at once; jump-none holds both ends; jump-both adds a step at each end
    expect(easing.sample(parsed('steps(4, jump-start)'), 0)).toBe(0.25);
    expect([0, 0.5, 1].map((x) => easing.sample(parsed('steps(3, jump-none)'), x))).toEqual([0, 0.5, 1]);
    expect(easing.sample(parsed('steps(1, jump-both)'), 0)).toBe(0.5);
    expect(easing.sample(parsed('linear(0, 0.25 40%, 1)'), 0.2)).toBeCloseTo(0.125, 5);
  });

  it('writes a spring as the linear() curve it traces over the duration, for every damping regime', () => {
    for (const spring of ['spring(1, 170, 26)', 'spring(1, 100, 20)', 'spring(1, 100, 40)', 'spring(2, 80, 4)']) {
      const css = easing.css(parsed(spring), 800);
      expect(css.startsWith('linear(0, ')).toBe(true);
      expect(css.endsWith(', 1)')).toBe(true);
      const values = css.slice('linear('.length, -1).split(', ').map(Number);
      expect(values.every(Number.isFinite)).toBe(true);
      expect(values.length).toBe(49);
      // and the browser reads the text it writes as a linear() of its own
      expect(easing.parse(css)?.kind).toBe('linear');
    }
    // an under-damped spring overshoots its rest
    const loose = easing.css(parsed('spring(2, 80, 4)'), 2000).slice('linear('.length, -1).split(', ').map(Number);
    expect(Math.max(...loose)).toBeGreaterThan(1);
    // every other easing is written as it reads
    expect(easing.css(parsed('ease-in-out'), 500)).toBe('ease-in-out');
  });

  it('offers presets it reads itself', () => {
    for (const preset of easing.presets) expect(easing.parse(preset), preset).not.toBeNull();
  });
});
