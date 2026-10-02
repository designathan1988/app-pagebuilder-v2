// The colours the site uses (src/core/design/site-colours.ts): one spelling per colour, however it is written.
import { describe, expect, it } from 'vitest';
import { colourKey } from './site-colours.ts';

describe('a colour of the site', () => {
  it('is one colour whatever its spelling', () => {
    expect(colourKey('#B9512A')).toBe('#b9512a');
    expect(colourKey('#fff')).toBe('#ffffff');
    expect(colourKey('rgb(185, 81, 42)')).toBe('#b9512a');
    expect(colourKey('#b9512aff')).toBe('#b9512a');
  });
  it('keeps an alpha that is not opaque', () => {
    expect(colourKey('rgba(0, 0, 0, 0.5)')).toBe('#00000080');
    expect(colourKey('#0008')).toBe('#00000088');
  });
  it('is no colour for any other text', () => {
    expect(colourKey('red')).toBeNull();
    expect(colourKey('var(--brand)')).toBeNull();
    expect(colourKey('1px solid #fff')).toBeNull();
  });
});
