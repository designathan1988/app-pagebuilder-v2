// The Layout Composer's doors driven as a person does (spec layout-composer; the module's canvas tool:
// src/modules/layout-composer/interaction/tool.ts): a stroke drawn with the button held on the stage, a handle dragged
// from where the canvas draws it, a region clicked. A step's points are in the composed container's px; the runner
// puts each on the screen through the stage's drawn box and the intent's width it carries (data-viewport-width), so
// the tool reads back the same whole px. The key the stroke's mode stands for (interactions.json layout-stroke) is
// held through it; a mode no key gives is the tool chosen, which a layout.view step before it chose.
import fs from 'node:fs';
import { expect, type Page } from '../../tests/support/test.ts';

interface Point {
  readonly x: number;
  readonly y: number;
}

const interactions = JSON.parse(fs.readFileSync('manifest/interactions.json', 'utf8')) as { gestures: { id: string; modifiers: { key: string; meaning: string }[] }[] };
// the modes the keys held during a stroke stand for, by the meaning the gesture gives them
const MEANINGS: Readonly<Record<string, string>> = { 'merge-swept-regions': 'merge', 'subtract-dragged-box': 'subtract', 'cut-along-stroke': 'cut' };
const KEY_OF_MODE: Readonly<Record<string, string>> = Object.fromEntries((interactions.gestures.find((g) => g.id === 'layout-stroke')?.modifiers ?? []).map((m) => [MEANINGS[m.meaning] ?? '', m.key]));
const MODIFIER_KEY: Readonly<Record<string, string>> = { Ctrl: 'Control', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta' };

export const LAYOUT_GESTURES: readonly string[] = ['layout-stroke', 'layout-handle', 'layout-click'];

const isPoint = (p: unknown): p is Point => typeof p === 'object' && p !== null && typeof (p as Point).x === 'number' && typeof (p as Point).y === 'number';

// The screen point of a point of the container: the nearest whole screen px whose reading is that point.
async function screenOf(page: Page): Promise<(p: Point) => Point> {
  const stage = page.locator('[data-layout-stage]');
  await expect(stage, 'the Layout Composer draws its stage').toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const box = await stage.boundingBox();
  const width = Number(await stage.getAttribute('data-viewport-width'));
  if (box === null || !(width > 0)) throw new Error('the Layout Composer stage is not laid out');
  const scale = box.width / width;
  return (p) => ({ x: box.x + p.x * scale, y: box.y + p.y * scale });
}

async function held(page: Page, key: string | undefined, act: () => Promise<void>) {
  if (key !== undefined) await page.keyboard.down(key);
  await act();
  if (key !== undefined) await page.keyboard.up(key);
}

// One step of a Layout Composer door, by its gesture.
export async function driveLayout(page: Page, ref: string, gesture: string, modifier: string | null, args: Readonly<Record<string, unknown>>): Promise<void> {
  const screen = await screenOf(page);
  if (gesture === 'layout-click') {
    const regions = args.regions;
    const id = Array.isArray(regions) && typeof regions[0] === 'string' ? regions[0] : null;
    if (id === null) throw new Error(`step ${ref}: a region click names the region it clicks`);
    const region = page.locator(`[data-layout-region="${id}"]`);
    await expect(region, `step ${ref}: the region ${id} is drawn`).toBeVisible();
    const box = await region.boundingBox();
    if (box === null) throw new Error(`step ${ref}: the region ${id} is not laid out`);
    // its label's corner is the region's own, wherever regions inside it lie
    await held(page, modifier === null ? undefined : MODIFIER_KEY[modifier], () => page.mouse.click(box.x + 4, box.y + box.height - 4));
    return;
  }
  const points = Array.isArray(args.points) ? args.points.filter(isPoint) : [];
  if (points.length < 2) throw new Error(`step ${ref}: a stroke goes through two points or more`);
  const onScreen = points.map(screen);
  // every point lies where the person sees the stage: on the canvas, not under a panel or past its edge
  const visible = await page.locator('[data-canvas-stage]').boundingBox();
  if (visible === null) throw new Error(`step ${ref}: the canvas stage is not laid out`);
  for (const p of onScreen) if (p.x < visible.x || p.x > visible.x + visible.width || p.y < visible.y || p.y > visible.y + visible.height) throw new Error(`step ${ref}: the point ${String(p.x)},${String(p.y)} lies outside the canvas the person sees`);
  let from = onScreen[0] as Point;
  if (gesture === 'layout-handle') {
    const handle = page.locator(`[data-layout-handle="${String(args.handle)}"]`);
    await expect(handle, `step ${ref}: the handle ${String(args.handle)} is drawn`).toBeVisible();
    const box = await handle.boundingBox();
    if (box === null) throw new Error(`step ${ref}: the handle is not laid out`);
    from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  const mode = typeof args.mode === 'string' ? args.mode : 'auto';
  const key = gesture === 'layout-stroke' ? KEY_OF_MODE[mode] : undefined;
  await held(page, key === undefined ? undefined : MODIFIER_KEY[key], async () => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const point of onScreen.slice(1)) await page.mouse.move(point.x, point.y, { steps: 6 });
    await page.mouse.up();
  });
}
