// The Insert panel's search (jornada03 J11, J12): accents and case aside, the name first, then the words that also
// name an entry (its English name, its synonyms), then its tag.
import { describe, expect, it } from 'vitest';
import { paletteRank } from './palette.ts';

describe('the palette search', () => {
  it('reads a text without its accents, in any case', () => {
    expect(paletteRank('titulo', 'Título', 'h1')).toBe(0);
    expect(paletteRank('PARAGRAFO', 'Parágrafo', 'p')).toBe(0);
  });
  it('ranks the name, then a name that starts with it, then a word of it, then a name holding it', () => {
    expect(paletteRank('link', 'Link', 'a')).toBe(0);
    expect(paletteRank('link', 'Link block', 'a')).toBe(1);
    expect(paletteRank('link', 'Bloco de link', 'a')).toBe(2);
    expect(paletteRank('ink', 'Link', 'a')).toBe(3);
  });
  it('finds an entry by its synonyms and its English name, then by its tag', () => {
    expect(paletteRank('texto', 'Parágrafo', 'p', ['Paragraph', 'texto corpo parágrafo'])).toBe(4);
    expect(paletteRank('botao', 'Botão', 'button')).toBe(0);
    expect(paletteRank('button', 'Botão', 'button', ['Button'])).toBe(4);
    expect(paletteRank('blockq', 'Citação', 'blockquote')).toBe(5);
    expect(paletteRank('zzz', 'Citação', 'blockquote', ['Blockquote'])).toBeNull();
  });
});
