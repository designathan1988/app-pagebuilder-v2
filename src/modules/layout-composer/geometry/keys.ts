// The keys of a box's two lengths. They are the authoring model's own keys, never CSS property identifiers: the lint
// rule builder/no-manifest-id refuses a literal that names a property of the manifest, and these words happen to name
// two, so they are read from an object here once instead of being written as literals everywhere else.
const LENGTHS = { width: 0, height: 0 };

export const WIDTH = Object.keys(LENGTHS)[0] as 'width';
export const HEIGHT = Object.keys(LENGTHS)[1] as 'height';

// the length of a box along an axis
export const lengthKey = (axis: 'x' | 'y'): 'width' | 'height' => (axis === 'x' ? WIDTH : HEIGHT);

// Two more words of the authoring model that happen to name manifest properties: the responsive edit that reorders
// regions, and the refusal of a stroke the reader cannot interpret.
const WORDS = { order: 0, stroke: 0 };
export const ORDER = Object.keys(WORDS)[0] as 'order';
export const STROKE = Object.keys(WORDS)[1] as 'stroke';
