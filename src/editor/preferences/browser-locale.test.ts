// The editor opens in the browser's language (jornada03 J26) when the person chose none.
import { describe, expect, it } from 'vitest';
import { browserLocale, loadPreferences } from './preferences.ts';

const none = { read: () => null, write: () => {} };

describe('the language the editor opens in', () => {
  it('is the first browser language it speaks, exactly or by its main tag', () => {
    expect(browserLocale(['pt-BR', 'en'])).toBe('pt-BR');
    expect(browserLocale(['pt-PT'])).toBe('pt-BR');
    expect(browserLocale(['de-DE', 'en-GB'])).toBe('en');
    expect(browserLocale(['ja'])).toBe('en');
  });
  it('is the browser’s with nothing stored, and the person’s own choice once stored', () => {
    expect(loadPreferences(none, ['pt-BR']).locale).toBe('pt-BR');
    expect(loadPreferences({ read: () => JSON.stringify({ locale: 'en' }), write: () => {} }, ['pt-BR']).locale).toBe('en');
  });
});
