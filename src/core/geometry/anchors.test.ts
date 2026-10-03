// position.setAnchors on fractional measures, as the canvas measures a page: the insets and sizes it writes are whole
// px and never leave a box smaller than the one drawn (the audit's AUD-35: Intro, 232.45 px wide, anchored on both
// edges got two rounded insets 0.42 px too close, and its one line of text wrapped to two).
import { describe, expect, it } from 'vitest';
import type { NodeId } from '../../generated/commands.ts';
import type { DocNode } from '../document/model.ts';
import { fixedLayout, type Place } from '../ports/layout.ts';
import { coupledScene } from '../style/couplings.ts';
import { documentOf, node, RULES, runHandler } from '../testing/handlers.ts';
import { setAnchorsCommand } from './anchors.ts';

// a paragraph positioned absolute in a 400 px wide section, where the canvas measures it
const PARAGRAPH = 'n-intro';
function anchored(base: Record<string, string>) {
  const intro = node(PARAGRAPH, 'paragraph', 'p', { styles: { desktop: { base: { position: 'absolute', ...base } } }, text: 'Fresh coffee, roasted every week.' });
  const page = node('n-page', 'page', 'body', { children: [node('n-hero', 'section', 'section', { children: [intro] })] });
  return documentOf({ pages: [{ id: 'p-home', name: 'Home', file: 'index.html', tree: page }] as never });
}
const MEASURED: Place = { left: 10.6, top: 5.2, right: 156.953, bottom: 20.4, width: 232.447, height: 24.005 };
const layoutOf = (place: Place) => fixedLayout({}, { [PARAGRAPH as NodeId]: place });
const baseOf = (ran: ReturnType<typeof runHandler>) => (ran.document.pages[0]?.tree.children[0]?.children[0] as DocNode).styles.desktop?.base ?? {};
const px = (value: unknown) => Number.parseFloat(String(value));
const CONTAINING = MEASURED.left + MEASURED.width + MEASURED.right;

describe('position.setAnchors on fractional measures', () => {
  it('anchors both edges with whole insets that leave the box at least as wide as drawn', () => {
    const ran = runHandler(setAnchorsCommand, anchored({}), { edge: 'right', mode: 'toggle' }, { selection: [PARAGRAPH], layout: layoutOf(MEASURED) });
    const base = baseOf(ran);
    expect(ran.problems).toEqual([]);
    expect([base.left, base.right]).toEqual(['11px', '156px']);
    // what the containing block leaves between the two insets: never narrower than the text it holds
    expect(CONTAINING - px(base.left) - px(base.right)).toBeGreaterThanOrEqual(MEASURED.width);
    expect(base.width).toBeUndefined();
  });

  it('gives one edge back a size rounded up, so the text it holds still fits', () => {
    const both = anchored({ left: '11px', right: '156px' });
    const ran = runHandler(setAnchorsCommand, both, { edge: 'left', mode: 'toggle' }, { selection: [PARAGRAPH], layout: layoutOf(MEASURED) });
    const base = baseOf(ran);
    expect([base.left, base.right, base.width]).toEqual([undefined, '157px', '233px']);
  });

  it('reads a measure within a thousandth of a whole px as that px, never one more or one less', () => {
    const even: Place = { left: 10, top: 0, right: 158.0000004, bottom: 0, width: 231.9999996, height: 24 };
    const ran = runHandler(setAnchorsCommand, anchored({ left: '10px', right: '158px' }), { edge: 'left', mode: 'toggle' }, { selection: [PARAGRAPH], layout: layoutOf(even) });
    expect(baseOf(ran).width).toBe('232px');
    const wide = runHandler(setAnchorsCommand, anchored({}), { edge: 'right', mode: 'toggle' }, { selection: [PARAGRAPH], layout: layoutOf(even) });
    expect([baseOf(wide).left, baseOf(wide).right]).toEqual(['10px', '158px']);
  });
});

describe('keepVisualPlace on fractional measures', () => {
  it('writes the place an element keeps in whole px', () => {
    const intro = node(PARAGRAPH, 'paragraph', 'p');
    const scene = coupledScene(intro, null, { position: 'absolute' }, null, RULES, () => MEASURED);
    expect([scene.own.left, scene.own.top]).toEqual(['11px', '5px']);
  });
});
