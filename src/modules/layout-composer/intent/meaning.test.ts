import { describe, expect, it } from 'vitest';
import { drawn } from '../testing/ports.ts';
import { inferMeaning, type MeaningWords } from './meaning.ts';

const WORDS: MeaningWords = { name: (key) => `[${key}]`, numbered: (n) => `Region ${n}`, generic: (name) => /^Region \d+$/.test(name) };
const meanings = (graph: ReturnType<typeof drawn>) => graph.regions.map((r) => `${r.semantic} ${r.name}`);

describe('what a page layout plainly means', () => {
  it('reads a band on top, a narrow column beside the content and a band below', () => {
    const page = drawn(1440, 900, [
      { x: 40, y: 32, width: 1360, height: 96 },
      { x: 40, y: 160, width: 300, height: 560 },
      { x: 372, y: 160, width: 1028, height: 560 },
      { x: 40, y: 752, width: 1360, height: 112 },
    ]);
    expect(meanings(inferMeaning(page, WORDS, true))).toEqual(['header [header]', 'aside [sidebar]', 'main [content]', 'footer [footer]']);
  });

  it('reads again what it read before: a content cut in two is a sidebar beside the content, never two contents', () => {
    const body = inferMeaning(drawn(1440, 900, [{ x: 40, y: 32, width: 1360, height: 96 }, { x: 40, y: 160, width: 1360, height: 700 }]), WORDS, true);
    expect(meanings(body)).toEqual(['header [header]', 'main [content]']);
    // the cut's part takes the cut region's name with its number, and its meaning
    const cut = { ...body, regions: [...body.regions.map((r) => (r.id === 'r2' ? { ...r, box: { ...r.box, width: 330 } } : r)), { ...(body.regions[1] as (typeof body.regions)[number]), id: 'r3', name: '[content] 3', box: { x: 370, y: 160, width: 1030, height: 700 } }] };
    const read = inferMeaning(cut, WORDS, true);
    expect(meanings(read)).toEqual(['header [header]', 'aside [sidebar]', 'main [content]']);
    // two columns made equal: the content stays where it was
    const even = inferMeaning({ ...read, regions: read.regions.map((r) => (r.id === 'r2' ? { ...r, box: { ...r.box, width: 680 } } : r.id === 'r3' ? { ...r, box: { ...r.box, x: 720, width: 680 } } : r)) }, WORDS, true);
    expect(even.regions.find((r) => r.semantic === 'main')?.id).toBe('r3');
  });

  it('reads cards in any layout, and the plain region holding only them as a section', () => {
    const cards = drawn(1200, 600, [{ x: 0, y: 0, width: 1200, height: 600 }, ...[0, 1, 2, 3].map((i) => ({ x: 24 + i * 294, y: 24, width: 270, height: 300 }))], (r, i) => (i === 0 ? r : { ...r, parent: 'r1' }));
    expect(meanings(inferMeaning(cards, WORDS, false))).toEqual(['section Region 1', 'article [item] 1', 'article [item] 2', 'article [item] 3', 'article [item] 4']);
    // a card the repeat handle copied ("[item] 1 2") is numbered with the others
    const copied = { ...cards, regions: cards.regions.map((r) => (r.id === 'r5' ? { ...r, name: '[item] 1 2', semantic: 'article' as const } : r)) };
    expect(meanings(inferMeaning(copied, WORDS, false)).at(-1)).toBe('article [item] 4');
    // the page's own meanings are never read outside the page, and a template's regions are its own
    const nested = drawn(1200, 600, [{ x: 0, y: 0, width: 1200, height: 96 }, { x: 0, y: 128, width: 1200, height: 400 }], (r) => ({ ...r, semantic: 'header', name: '[header]' }));
    expect(meanings(inferMeaning(nested, WORDS, false))).toEqual(['header [header]', 'header [header]']);
  });

  it('leaves what the person named or chose, and what is not plainly a band or a column', () => {
    const page = drawn(1440, 900, [{ x: 40, y: 32, width: 1360, height: 96 }, { x: 40, y: 160, width: 1360, height: 700 }], (r, i) => (i === 0 ? { ...r, name: 'Top' } : { ...r, chosen: true }));
    expect(meanings(inferMeaning(page, WORDS, true))).toEqual(['div Top', 'div Region 2']);
    // three alike columns are no main content: they are cards, numbered in reading order
    const three = drawn(1200, 400, [0, 1, 2].map((i) => ({ x: i * 408, y: 0, width: 384, height: 400 })));
    expect(meanings(inferMeaning(three, WORDS, true))).toEqual(['article [item] 1', 'article [item] 2', 'article [item] 3']);
    // a page that already has its main content never gets a second one, whichever region is now the widest
    const read = inferMeaning(drawn(1440, 900, [{ x: 0, y: 0, width: 400, height: 600 }, { x: 424, y: 0, width: 1016, height: 600 }]), WORDS, true);
    const widened = { ...read, regions: read.regions.map((r) => (r.id === 'r1' ? { ...r, box: { ...r.box, width: 1100 } } : { ...r, box: { ...r.box, x: 1124, width: 316 } })) };
    expect(meanings(inferMeaning(widened, WORDS, true)).filter((m) => m.startsWith('main'))).toHaveLength(1);
  });
});
