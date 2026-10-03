// Text as a search compares it (PRODUCT.md §5): lower case, without accents, so "ÉLÉMENT" finds "element". The command
// bar's query (src/editor/command-bar/command-bar.ts) and the Style tab's Find a property (src/editor/inspector/
// sections.ts) compare through it.
export const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// A text as the words of a file name, a class name or an id: without accents ("Seção" -> "secao"), lower case, every
// run of anything but a letter or a digit one dash, no dash at either end. The one rule for every name the project
// derives from a person's words (a page's file, an exported element's class, a form control's id).
export const slug = (text: string): string => fold(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
