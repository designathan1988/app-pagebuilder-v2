// The numeric pairing of the app with the canonical design (STG-0.4): what each side draws in a state — every region
// both mark with data-region, every control both mark with data-door (the n-th drawn of each door, in document order) —
// measured the same way, and the divergences between the two beyond the tolerances below.
import type { Page } from '@playwright/test';

export interface Measured {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly font: string;
  readonly color: string;
  readonly background: string;
  readonly radius: string;
  // a control holds words (its width is its words'), else it is an icon or a box
  readonly worded: boolean;
  // it draws an icon (an svg, whose strokes take its colour)
  readonly icon: boolean;
  // it draws an edge (a border), so its corners show
  readonly edged: boolean;
  // the name it shows (a row's name, a tab's words), which pairs repeated controls whose order differs on the two sides
  readonly label: string;
}
export interface Drawn {
  readonly regions: readonly Measured[];
  readonly controls: readonly Measured[];
}
export interface Divergence {
  readonly kind: 'region' | 'control';
  readonly id: string;
  readonly property: string;
  readonly canon: string;
  readonly app: string;
}

// What a page draws inside the window: its regions and its controls, each keyed by its mark (a control: its door and
// the order it is drawn in among that door's controls).
// faces: where a side marks a door or a region on a part of what a person sees, or around it, the element that is
// that thing (a mark -> the selector of its closest ancestor, or of the element inside it, to measure), each with its
// reason (tools/parity/faces.json, listed in PAIRING.md)
// aliases: a door the design marks that the app draws as others (a design door -> the app's doors, in drawn order)
export interface FaceRule {
  readonly closest?: string;
  readonly inside?: string;
}
export const drawn = (page: Page, faces: Readonly<Record<string, FaceRule>> = {}, aliases: Readonly<Record<string, readonly string[]>> = {}): Promise<Drawn> =>
  page.evaluate(({ faces, aliases }) => {
    const within = (r: DOMRect) => r.width >= 2 && r.height >= 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    // what shows: in the window, and neither hidden nor transparent (a row's actions wait for its hover at opacity 0)
    const shows = (el: Element) => within(el.getBoundingClientRect()) && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    // the face a rule names for a mark, if it finds one
    const listed = (el: Element, mark: string): Element | null => {
      const rule = faces[mark];
      if (rule === undefined) return null;
      return (rule.closest === undefined ? null : el.closest(rule.closest)) ?? (rule.inside === undefined ? null : el.querySelector(rule.inside));
    };
    // a control's face: the element a person reads and presses, whichever element carries the door's mark on each side
    // (the design marks an input, the app the field's row): the field's visible box where the side marks it
    // (data-face: the app's own mark of a field's face, its input transparent at rest), else the input, else the mark
    const faceOf = (el: Element): Element => {
      if (el.matches('input, select, textarea, button')) return el;
      return el.querySelector('[data-face]') ?? el.querySelector('input:not([type=hidden]), select, textarea') ?? el;
    };
    const measure = (marked: Element, id: string) => {
      const mark = id.replace(/ \d+$/, '');
      const el = listed(marked, mark) ?? (id.includes(' ') ? faceOf(marked) : marked);
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        id,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
        font: `${s.fontSize} ${s.fontWeight}`,
        color: s.color,
        background: s.backgroundColor,
        radius: s.borderTopLeftRadius,
        // a region holds words of its own only in its own text nodes: a region around others' words (the text toolbar
        // over the page's heading) draws no ink of its own
        worded: id.includes(' ') ? (el.textContent ?? '').trim() !== '' || (el instanceof HTMLInputElement && el.value.trim() !== '') : [...el.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim() !== ''),
        label: (marked.querySelector('.nm, .row__name')?.textContent ?? marked.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60),
        icon: id.includes(' ') ? el.querySelector('svg') !== null || el.localName === 'svg' : [...el.children].some((child) => child.localName === 'svg'),
        // an edge that draws: a transparent border (the doors' 1 px kept for their hover) draws no corner
        edged: parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none' && !/^rgba\(.*,\s*0\)$|^transparent$/.test(s.borderTopColor),
      };
    };
    // a mark shows when what is measured for it does (a field invisible until pressed shows by its icon box)
    const showsAs = (el: Element, mark: string) => shows(listed(el, mark) ?? el);
    const regions = [...document.querySelectorAll('[data-region]')].filter((el) => showsAs(el, el.getAttribute('data-region') ?? '')).map((el) => measure(el, el.getAttribute('data-region') as string));
    const seen = new Map<string, number>();
    const controls = [...document.querySelectorAll('[data-door]')]
      .filter((el) => showsAs(el, el.getAttribute('data-door') ?? ''))
      .map((el) => {
        const door = el.getAttribute('data-door') as string;
        const n = (seen.get(door) ?? 0) + 1;
        seen.set(door, n);
        return measure(el, `${door} ${n}`);
      });
    for (const [door, others] of Object.entries(aliases)) {
      const drawnAs = [...document.querySelectorAll(others.map((one) => (one.startsWith(".") ? one : `[data-door="${one}"]`)).join(', '))].filter((el) => shows(el));
      drawnAs.forEach((el, i) => controls.push(measure(el, `${door} ${i + 1}`)));
    }
    return { regions, controls };
  }, { faces, aliases });

// the tolerances: a size within 2 px (a region's within 4: what it holds may differ by a line), a colour within 16 of
// each channel's sum of differences, the font and the radius alike
const SIZE = { region: 4, control: 2 } as const;
const COLOUR = 16;
const channels = (colour: string) => (colour.match(/[\d.]+/g) ?? []).map(Number);
const colourDistance = (a: string, b: string) => {
  const [x, y] = [channels(a), channels(b)];
  // a transparent colour (alpha 0) is no colour, whatever its channels say
  const clear = (c: number[]) => c.length === 4 && c[3] === 0;
  if (clear(x) || clear(y)) return clear(x) && clear(y) ? 0 : Number.POSITIVE_INFINITY;
  return [0, 1, 2].reduce((sum, i) => sum + Math.abs((x[i] ?? 0) - (y[i] ?? 0)), 0);
};

// The divergences of one kind of thing drawn: a thing the canonical draws that the app does not, and every measure of
// a thing both draw that differs beyond its tolerance, where it shows. (A region or a control the app draws and the
// canonical does not is the app's own: the canonical shows one state of one page.) What shows: a width where no words
// set it; a font where there are words; a colour where there are words or an icon; corners where a background or an
// edge draws them.
export function diverging(kind: Divergence['kind'], canon: readonly Measured[], app: readonly Measured[]): Divergence[] {
  const found: Divergence[] = [];
  const doors = new Set(app.map((one) => one.id.split(' ')[0]));
  for (const one of canon) {
    // the app's control of the same door showing the same name, else the one drawn at the same place in the order
    const door = one.id.replace(/ \d+$/, '');
    const named = one.label === '' ? undefined : app.find((candidate) => candidate.id.replace(/ \d+$/, '') === door && candidate.label === one.label);
    const other = named ?? app.find((candidate) => candidate.id === one.id);
    if (other === undefined) {
      // a control drawn fewer times in the app is the content's (the project holds fewer rows); a door the app draws
      // nowhere in the state is missing
      if (kind === 'region' || !doors.has(one.id.split(' ')[0])) found.push({ kind, id: one.id, property: 'drawn', canon: 'yes', app: 'no' });
      continue;
    }
    const add = (property: string, a: string, b: string) => found.push({ kind, id: one.id, property, canon: a, app: b });
    if (Math.abs(one.height - other.height) > SIZE[kind]) add('height', `${one.height}`, `${other.height}`);
    if ((kind === 'region' || !one.worded) && Math.abs(one.width - other.width) > SIZE[kind]) add('width', `${one.width}`, `${other.width}`);
    // a region's font is its words' only where it holds them itself: a region around others' words (the text
    // toolbar over the page's heading) draws no font of its own
    if (kind === 'control' && (one.worded || other.worded) && one.font !== other.font) add('font', one.font, other.font);
    if ((one.worded || one.icon || other.worded || other.icon) && colourDistance(one.color, other.color) > COLOUR) add('colour', one.color, other.color);
    if (colourDistance(one.background, other.background) > COLOUR) add('background', one.background, other.background);
    const cornered = (m: Measured) => m.edged || colourDistance(m.background, 'rgba(0, 0, 0, 0)') !== 0;
    if ((cornered(one) || cornered(other)) && one.radius !== other.radius) add('radius', one.radius, other.radius);
  }
  return found;
}
