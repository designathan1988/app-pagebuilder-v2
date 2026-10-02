// A chord as a key cap shows it (the canonical menus and palette: Alt+↑, ↑↓ choose, Esc): the arrow keys as arrows and
// Escape as Esc; every other key keeps the name the manifest gives it. The chord itself, as the keymap matches it and a
// tooltip says it, is unchanged.
const CAPS: Readonly<Record<string, string>> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc' };
export function chordCap(chord: string): string {
  return chord.replace(/Arrow(Up|Down|Left|Right)|Escape/g, (key) => CAPS[key] ?? key);
}
