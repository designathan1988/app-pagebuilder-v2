// The browser's own width of a line (a border side, an outline, a column rule) for an element of a kind, for the fields
// that show what the page gives an element when no stylesheet of the page declares it (BW1; canvas/coordinates.ts reads
// the declared ones). The canvas's page cannot tell it: the browser snaps a line's width to whole device pixels and
// reports it divided by the zoom (css-values-4 "snap as a border width"), so a 2 px inset frame reads 1.69014px at
// 59 %. The width is read once per kind in a shadow tree of the editor's own document, which no author stylesheet
// reaches, at a zoom so large that the snap leaves the width as the browser declares it, whatever the screen's scale.

const PROBE_ZOOM = 1000;
// two decimals: what is left of the snap at that zoom is far below them
const PLACES = 100;
const known = new Map<string, string>();
let probes: ShadowRoot | null = null;

// the initial width of a line, medium, which the browser draws 3 px wide: the width of a line the browser itself draws
// none of (a style set by the page alone)
const MEDIUM = '3px';
const NO_LINE: ReadonlySet<string> = new Set(['none', 'hidden']);

// The width, in px, of the line of an element of this tag and type that no stylesheet of the page gives a width: the
// browser's own when it draws that line itself (an input's, a frame's), else the initial medium.
export function browserLineWidth(tag: string, type: string | null, property: string, styleProperty: string): string {
  const key = `${tag} ${type ?? ''} ${property}`;
  const found = known.get(key);
  if (found !== undefined) return found;
  if (probes === null) {
    const host = document.createElement('div');
    host.hidden = true;
    host.setAttribute('aria-hidden', 'true');
    document.body.append(host);
    probes = host.attachShadow({ mode: 'closed' });
  }
  const probe = document.createElement(tag);
  if (type !== null) probe.setAttribute('type', type);
  probe.style.zoom = String(PROBE_ZOOM);
  probes.append(probe);
  const style = getComputedStyle(probe);
  const width = parseFloat(style.getPropertyValue(property));
  const drawn = !NO_LINE.has(style.getPropertyValue(styleProperty));
  probe.remove();
  const value = !drawn || Number.isNaN(width) ? MEDIUM : `${Math.round(width * PLACES) / PLACES}px`;
  known.set(key, value);
  return value;
}
