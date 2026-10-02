// What the canvas draws while a stroke is held (spec "Preview"): the points so far and the reading a release there
// would commit, read by the same reader the command uses (gestures/recognize.ts readStroke). Pointer state, like the
// pointer owner's own drag views: nothing of it is document or editor state, and it is gone at the release.
import type { Point } from '../intent/model.ts';
import type { StrokeReading } from '../gestures/recognize.ts';

export interface StrokePreview {
  // the points of the stroke, in the container's px
  readonly points: readonly Point[];
  readonly reading: StrokeReading | null;
}

let current: StrokePreview | null = null;
const listeners = new Set<() => void>();

export const preview = {
  get: (): StrokePreview | null => current,
  set(next: StrokePreview | null): void {
    if (next === current) return;
    current = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
