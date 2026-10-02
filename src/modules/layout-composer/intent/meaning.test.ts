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
    expect(meanings(inferMeaning(page, WORDS))).toEqual(['header [header]', 'aside [sidebar]', 'main [content]', 'footer [footer]']);
  });

  it('reads again what it read before: a content cut in two is a sidebar beside the content, never two contents', () => {
    const body = inferMeaning(drawn(1440, 900, [{ x: 40, y: 32, width: 1360, height: 96 }, { x: 40, y: 160, width: 1360, height: 700 }]), WORDS);
    expect(meanings(body)).toEqual(['header [header]', 'main [content]']);
    // the cut's part takes the cut region's name with its number, and its meaning
    const cut = { ...body, regions: [...body.regions.map((r) => (r.id === 'r2' ? { ...r, box: { ...r.box, width: 330 } } : r)), { ...(body.regions[1] as (typeof body.regions)[number]), id: 'r3', name: '[content] 3', box: { x: 370, y: 160, width: 1030, height: 700 } }] };
    const read = inferMeaning(cut, WORDS);
    expect(meanings(read)).toEqual(['header [header]', 'aside [sidebar]', 'main [content]']);
    // two columns made equal: the content stays where it was
    const even = inferMeaning({ ...read, regions: read.regions.map((r) => (r.id === 'r2' ? { ...r, box: { ...r.box, width: 680 } } : r.id === 'r3' ? { ...r, box: { ...r.box, x: 720, width: 680 } } : r)) }, WORDS);
    expect(even.regions.find((r) => r.semantic === 'main')?.id).toBe('r3');
  });

  it('leaves what the person named or chose, and what is not plainly a band or a column', () => {
    const page = drawn(1440, 900, [{ x: 40, y: 32, width: 1360, height: 96 }, { x: 40, y: 160, width: 1360, height: 700 }], (r, i) => (i === 0 ? { ...r, name: 'Top' } : { ...r, chosen: true }));
    expect(meanings(inferMeaning(page, WORDS))).toEqual(['div Top', 'div Region 2']);
    // three alike columns: the widest is no wider than half the row, so none of them is the main content
    const three = drawn(1200, 400, [0, 1, 2].map((i) => ({ x: i * 408, y: 0, width: 384, height: 400 })));
    expect(meanings(inferMeaning(three, WORDS))).toEqual(['div Region 1', 'div Region 2', 'div Region 3']);
    // a page that already has its main content never gets a second one, whichever region is now the widest
    const read = inferMeaning(drawn(1440, 900, [{ x: 0, y: 0, width: 400, height: 600 }, { x: 424, y: 0, width: 1016, height: 600 }]), WORDS);
    const widened = { ...read, regions: read.regions.map((r) => (r.id === 'r1' ? { ...r, box: { ...r.box, width: 1100 } } : { ...r, box: { ...r.box, x: 1124, width: 316 } })) };
    expect(meanings(inferMeaning(widened, WORDS)).filter((m) => m.startsWith('main'))).toHaveLength(1);
  });
});
