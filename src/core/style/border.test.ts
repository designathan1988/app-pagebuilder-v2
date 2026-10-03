// The border field's text parted into style.setBorder's arguments (border.ts borderArgs): a whole border into its
// width, style and colour; an aspect's field into that aspect alone.
import { describe, expect, it } from 'vitest';
import { manifest } from '../../manifest/runtime.ts';
import { rulesFromManifest } from '../document/validate.ts';
import { borderArgs } from './border.ts';

const RULES = rulesFromManifest(manifest.elements, manifest.properties, manifest.html);

describe('the border field', () => {
  it('parts a whole border into its width, style and colour', () => {
    expect(borderArgs('border', '2px solid red', RULES)).toEqual({ width: '2px', style: 'solid', color: 'red' });
  });
  it('gives the text of an aspect of every side to that aspect', () => {
    expect(borderArgs('border-width', '1px 2px', RULES)).toEqual({ width: '1px 2px' });
  });
});
