// The label rule (src/editor/canvas/placement.ts placeLabel): a label takes the first free place around its element, and
// where none is free it covers the least it can and says so, so the selection's label then takes no press and a press
// meant for the text under it reaches the text (jornada03 J16: a button's label over a card's price selected the button).
import { describe, expect, it } from 'vitest';
import { placeLabel, type Box } from './placement.ts';

const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height });
const CANVAS = box(0, 0, 1000, 1000);
const SIZE = { width: 80, height: 16 };
const BUTTON = box(100, 200, 60, 30);

describe('the label of an element', () => {
  it('sits above the element where that space is free, and covers nothing', () => {
    const placed = placeLabel(BUTTON, SIZE, 4, [], CANVAS);
    expect(placed.placement).toBe('above');
    expect(placed.covers).toBe(false);
    expect(placed.box).toEqual(box(100, 180, 80, 16));
  });

  it('goes below when the text above takes the space, still covering nothing', () => {
    const price = box(90, 170, 200, 26);
    const placed = placeLabel(BUTTON, SIZE, 4, [price], CANVAS);
    expect(placed.placement).toBe('below');
    expect(placed.covers).toBe(false);
  });

  it('says it covers content when text surrounds the element on every side', () => {
    const above = box(0, 150, 400, 48);
    const below = box(0, 232, 400, 48);
    const placed = placeLabel(BUTTON, SIZE, 4, [above, below], CANVAS);
    expect(placed.covers).toBe(true);
  });
});
