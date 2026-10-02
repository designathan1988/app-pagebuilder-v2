// Why the composer refuses something (spec "Error recovery": an invalid operation changes nothing and says why). Each
// problem is a code with the values it names; the editor says it through the catalogue (layout.problem.<code>), so
// no English sentence of the engine ever reaches the person.
export type ProblemCode =
  | 'version'
  | 'viewport'
  | 'variable'
  | 'unknown-variable'
  | 'morph'
  | 'morph-region'
  | 'reference'
  | 'duplicate-region'
  | 'unknown-region'
  | 'degenerate'
  | 'sizing'
  | 'padding'
  | 'radius'
  | 'polygon'
  | 'polygon-bounds'
  | 'self-intersecting'
  | 'holes-without-outline'
  | 'hole-outside'
  | 'cycle'
  | 'missing-parent'
  | 'outside-parent'
  | 'overlap'
  | 'duplicate-constraint'
  | 'orphan-constraint'
  | 'constraint-value'
  | 'conflict'
  | 'responsive-rule'
  | 'responsive-region'
  | 'responsive-order'
  | 'content-children'
  | 'content-shape'
  | 'merge-count'
  | 'merge-siblings'
  | 'merge-disconnected'
  | 'merge-content'
  | 'cut-nothing'
  | 'cut-nested'
  | 'cut-content'
  | 'duplicate-content'
  | 'repeat-count'
  | 'distribute-count'
  | 'unknown-boundary'
  | 'unknown-vertex'
  | 'unknown-edge'
  | 'bend-span'
  | 'bend-shape'
  | 'group-siblings'
  | 'gap-siblings'
  | 'interpretation-parents'
  | 'template'
  | 'template-name'
  | 'nothing-selected'
  | 'stroke'
  // the host's: the composed container is gone or holds no layout, an element the layout places is no longer there
  // (or would be lost), a declaration the browser does not take
  | 'container'
  | 'content-missing'
  | 'declaration'
  // a property the person set: a page element keeps its own tag; a value that is not one of the property's
  | 'content-semantic'
  | 'value';

export interface LayoutProblem {
  readonly code: ProblemCode;
  readonly params: Readonly<Record<string, string | number>>;
}

export const problem = (code: ProblemCode, params: Readonly<Record<string, string | number>> = {}): LayoutProblem => ({ code, params });

// A refusal raised inside an operation: execute() turns it into the result's problems, so a refused operation never
// produces a graph.
export class LayoutRefusal extends Error {
  readonly problem: LayoutProblem;
  constructor(code: ProblemCode, params: Readonly<Record<string, string | number>> = {}) {
    super(`layout ${code}`);
    this.problem = problem(code, params);
  }
}

export function refuse(code: ProblemCode, params: Readonly<Record<string, string | number>> = {}): never {
  throw new LayoutRefusal(code, params);
}

// The catalogue key a problem is said with.
export const problemKey = (p: LayoutProblem): string => `layout.problem.${p.code}`;
