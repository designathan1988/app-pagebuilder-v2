// The one reader of an easing's text (plan stage 10, "aceleração: curva, passos, mola"): the CSS easing functions
// (the keywords, cubic-bezier(), steps(), linear()) and a spring, spring(mass, stiffness, damping), which CSS has no
// function for and which is written for the browser as the linear() curve it traces over the action's duration.
//
// The reader is one self-contained factory (it names nothing outside its own body): the editor calls it to validate a
// typed easing and to draw its curve, and the page's motion runtime embeds the very same function as text
// (src/editor/motion/script.ts), so the preview, the export and the editor read an easing alike. Keep it free of
// imports and of module-level names, or the embedded copy breaks (runtime/self-contained.test.ts proves it).
export interface ParsedEasing {
  readonly kind: 'keyword' | 'cubic-bezier' | 'steps' | 'linear' | 'spring';
  // the canonical text the document stores
  readonly text: string;
  readonly points?: readonly [number, number, number, number];
  readonly steps?: { readonly count: number; readonly position: 'jump-start' | 'jump-end' | 'jump-none' | 'jump-both' };
  readonly spring?: { readonly mass: number; readonly stiffness: number; readonly damping: number };
  // a linear() function's stops: output and input progress, input filled in where the text left it out
  readonly stops?: readonly (readonly [number, number])[];
}

export interface EasingKit {
  // the easing a text names, or null when it names none
  parse(text: string): ParsedEasing | null;
  // the easing's CSS text for an animation of this duration (a spring becomes linear())
  css(easing: ParsedEasing, durationMs: number): string;
  // the output progress at an input progress from 0 to 1 (the editor's curve); a spring reads the duration it runs over
  sample(easing: ParsedEasing, progress: number, durationMs?: number): number;
  // the presets the easing field offers besides typing
  readonly presets: readonly string[];
}

export function createEasing(): EasingKit {
  // the keywords' own cubic Bézier curves (CSS Easing Functions 1, §2.2)
  const KEYWORDS: Record<string, readonly [number, number, number, number]> = {
    linear: [0, 0, 1, 1],
    ease: [0.25, 0.1, 0.25, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
  };
  const STEP_KEYWORDS: Record<string, ParsedEasing['steps']> = {
    'step-start': { count: 1, position: 'jump-start' },
    'step-end': { count: 1, position: 'jump-end' },
  };
  const POSITIONS: Record<string, 'jump-start' | 'jump-end' | 'jump-none' | 'jump-both'> = {
    start: 'jump-start',
    end: 'jump-end',
    'jump-start': 'jump-start',
    'jump-end': 'jump-end',
    'jump-none': 'jump-none',
    'jump-both': 'jump-both',
  };
  // how many points a spring's linear() curve holds: enough for a smooth overshoot, few enough to stay short
  const SPRING_SAMPLES = 48;

  const number = (text: string): number | null => {
    const trimmed = text.trim();
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  };
  // trims a number for the canonical text: no trailing zeros, at most 6 decimals
  const short = (value: number): string => String(Number(value.toFixed(6)));
  const argumentsOf = (text: string, name: string): string[] | null => {
    const match = new RegExp(`^${name}\\((.*)\\)$`, 'i').exec(text);
    return match === null ? null : (match[1] ?? '').split(',').map((part) => part.trim());
  };

  function parse(text: string): ParsedEasing | null {
    const typed = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const keyword = KEYWORDS[typed];
    if (keyword !== undefined) return { kind: 'keyword', text: typed, points: keyword };
    const stepKeyword = STEP_KEYWORDS[typed];
    if (stepKeyword !== undefined) return { kind: 'steps', text: typed, steps: stepKeyword };
    const bezier = argumentsOf(typed, 'cubic-bezier');
    if (bezier !== null) {
      const values = bezier.map(number);
      if (values.length !== 4 || values.some((value) => value === null)) return null;
      const [x1, y1, x2, y2] = values as [number, number, number, number];
      // the x coordinates must stay in [0, 1] so the curve is a function of time
      if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null;
      return { kind: 'cubic-bezier', text: `cubic-bezier(${[x1, y1, x2, y2].map(short).join(', ')})`, points: [x1, y1, x2, y2] };
    }
    const steps = argumentsOf(typed, 'steps');
    if (steps !== null) {
      const count = number(steps[0] ?? '');
      const position = POSITIONS[steps[1] ?? 'end'];
      if (count === null || !Number.isInteger(count) || count < 1 || position === undefined || steps.length > 2) return null;
      // jump-none needs two steps at least (CSS Easing Functions 1, §2.3)
      if (position === 'jump-none' && count < 2) return null;
      return { kind: 'steps', text: `steps(${count}, ${position})`, steps: { count, position } };
    }
    const spring = argumentsOf(typed, 'spring');
    if (spring !== null) {
      const values = spring.map(number);
      if (values.length !== 3 || values.some((value) => value === null || value <= 0)) return null;
      const [mass, stiffness, damping] = values as [number, number, number];
      return { kind: 'spring', text: `spring(${[mass, stiffness, damping].map(short).join(', ')})`, spring: { mass, stiffness, damping } };
    }
    const linear = argumentsOf(typed, 'linear');
    if (linear !== null) return parseLinear(linear);
    return null;
  }

  // linear(0, 0.25 40%, 1): each stop an output and an optional input percentage; missing inputs are spread evenly
  // between their neighbours, as CSS Easing Functions 2 §2.1 says
  function parseLinear(parts: readonly string[]): ParsedEasing | null {
    if (parts.length < 2) return null;
    const raw: { output: number; input: number | null }[] = [];
    for (const part of parts) {
      const [outputText, inputText, extra] = part.split(' ');
      const output = number(outputText ?? '');
      if (output === null || extra !== undefined) return null;
      if (inputText === undefined) raw.push({ output, input: null });
      else {
        if (!inputText.endsWith('%')) return null;
        const input = number(inputText.slice(0, -1));
        if (input === null) return null;
        raw.push({ output, input: input / 100 });
      }
    }
    const first = raw[0];
    const last = raw[raw.length - 1];
    if (first === undefined || last === undefined) return null;
    if (first.input === null) first.input = 0;
    if (last.input === null) last.input = Math.max(1, ...raw.map((stop) => stop.input ?? 0));
    // inputs never go backwards
    let highest = first.input;
    for (const stop of raw) {
      if (stop.input !== null) {
        stop.input = Math.max(stop.input, highest);
        highest = stop.input;
      }
    }
    for (let index = 0; index < raw.length; index += 1) {
      if (raw[index]?.input !== null) continue;
      let end = index;
      while (raw[end]?.input === null) end += 1;
      const before = raw[index - 1]?.input ?? 0;
      const after = raw[end]?.input ?? 1;
      const gaps = end - index + 1;
      for (let at = index; at < end; at += 1) (raw[at] as { input: number | null }).input = before + ((after - before) * (at - index + 1)) / gaps;
    }
    const stops = raw.map((stop) => [stop.output, stop.input ?? 0] as const);
    const text = `linear(${stops.map(([output, input]) => `${short(output)} ${short(input * 100)}%`).join(', ')})`;
    return { kind: 'linear', text, stops };
  }

  // The position of a damped spring released from 0 towards 1, at a time in seconds: the three damping regimes of a
  // mass-spring-damper (under-, critically and over-damped).
  function springAt(parameters: { readonly mass: number; readonly stiffness: number; readonly damping: number }, seconds: number): number {
    const { mass, stiffness, damping } = parameters;
    const omega = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    if (Math.abs(zeta - 1) < 1e-6) return 1 - Math.exp(-omega * seconds) * (1 + omega * seconds);
    if (zeta < 1) {
      const frequency = omega * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * omega * seconds) * (Math.cos(frequency * seconds) + ((zeta * omega) / frequency) * Math.sin(frequency * seconds));
    }
    const root = Math.sqrt(zeta * zeta - 1);
    const fast = -omega * (zeta - root);
    const slow = -omega * (zeta + root);
    return 1 - (slow * Math.exp(fast * seconds) - fast * Math.exp(slow * seconds)) / (slow - fast);
  }

  function css(easing: ParsedEasing, durationMs: number): string {
    if (easing.kind !== 'spring' || easing.spring === undefined) return easing.text;
    const spring = easing.spring;
    const seconds = Math.max(durationMs, 1) / 1000;
    const points: string[] = ['0'];
    for (let index = 1; index < SPRING_SAMPLES; index += 1) points.push(short(springAt(spring, (index / SPRING_SAMPLES) * seconds)));
    // the action ends where the spring rests, whatever the duration cut it at
    points.push('1');
    return `linear(${points.join(', ')})`;
  }

  // a cubic Bézier's y for an x, by Newton's method on x(t) with a bisection fallback
  function bezierAt(points: readonly [number, number, number, number], x: number): number {
    const [x1, y1, x2, y2] = points;
    const curve = (a: number, b: number, t: number): number => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    const slope = (a: number, b: number, t: number): number => 3 * a * (1 - t) * (1 - t) + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
    let t = x;
    for (let round = 0; round < 8; round += 1) {
      const error = curve(x1, x2, t) - x;
      const d = slope(x1, x2, t);
      if (Math.abs(error) < 1e-7) return curve(y1, y2, t);
      if (Math.abs(d) < 1e-7) break;
      t -= error / d;
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let round = 0; round < 40; round += 1) {
      const value = curve(x1, x2, t);
      if (Math.abs(value - x) < 1e-7) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return curve(y1, y2, t);
  }

  function sample(easing: ParsedEasing, progress: number, durationMs = 1000): number {
    const x = Math.min(1, Math.max(0, progress));
    if (easing.points !== undefined) return bezierAt(easing.points, x);
    if (easing.steps !== undefined) {
      const { count, position } = easing.steps;
      // CSS Easing Functions 1 §2.3: the step taken at x, one more when the position jumps at the start, and the
      // number of jumps the position makes, the step clamped to them
      let step = Math.floor(x * count);
      if (position === 'jump-start' || position === 'jump-both') step += 1;
      const jumps = position === 'jump-none' ? count - 1 : position === 'jump-both' ? count + 1 : count;
      return Math.min(jumps, Math.max(0, step)) / jumps;
    }
    if (easing.stops !== undefined) {
      const stops = easing.stops;
      for (let index = 1; index < stops.length; index += 1) {
        const [outA, inA] = stops[index - 1] as readonly [number, number];
        const [outB, inB] = stops[index] as readonly [number, number];
        if (x <= inB) return inB === inA ? outB : outA + ((outB - outA) * (x - inA)) / (inB - inA);
      }
      return stops[stops.length - 1]?.[0] ?? 1;
    }
    // a spring traces its curve over the action's duration, as css() writes it
    if (easing.spring !== undefined) return x >= 1 ? 1 : springAt(easing.spring, (x * Math.max(durationMs, 1)) / 1000);
    return x;
  }

  return {
    parse,
    css,
    sample,
    presets: ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(0.34, 1.56, 0.64, 1)', 'steps(4, jump-end)', 'spring(1, 170, 26)'],
  };
}
