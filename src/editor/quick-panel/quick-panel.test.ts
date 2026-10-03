import { describe, expect, it } from 'vitest';
import { placeQuickPanel } from './quick-panel.ts';

const STAGE = { x: 0, y: 0, width: 900, height: 700 };
const SPACING = { gap: 12, inset: 20, above: 20 };
const PANEL = { width: 216, height: 560 };

describe('placeQuickPanel (src/editor/quick-panel/quick-panel.ts)', () => {
  it('takes the side with the most free room where the whole panel fits', () => {
    const placed = placeQuickPanel({ x: 100, y: 80, width: 200, height: 40 }, PANEL, STAGE, SPACING, null);
    // below: 580 free, above: none; right: 600 free wins over below
    expect(placed.x).toBe(312);
  });

  it('with no side holding it whole, covers the least of the element instead of pinning at the top', () => {
    // a text as wide as the page near its top: no side holds a 560 px tall panel beside it; pinned at the top it
    // covered the text whole, held below it it covers its lower half only
    const element = { x: 20, y: 100, width: 860, height: 40 };
    const placed = placeQuickPanel(element, PANEL, STAGE, SPACING, null);
    const overlap = Math.max(0, Math.min(placed.y + placed.height, element.y + element.height) - Math.max(placed.y, element.y));
    expect(placed.y).toBe(120);
    expect(overlap, 'less of the text is covered than the whole').toBe(20);
  });

  it("keeps the person's own offset, held inside the stage", () => {
    expect(placeQuickPanel({ x: 100, y: 80, width: 200, height: 40 }, PANEL, STAGE, SPACING, { x: 10, y: 20 })).toEqual({ x: 110, y: 100, ...PANEL });
  });
});
