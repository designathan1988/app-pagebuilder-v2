// The motion runtime's reading of a target (spec motion-runtime, Targets): the elements an action acts on, from the
// element whose trigger fired (the source). A relative kind walks the source's family; a class or a selector looks in
// the source's own document, which is the iframe's on the canvas and the page's on an exported site.
//
// Self-contained: the page's motion script embeds this function as text (src/editor/motion/script.ts), so it names
// nothing outside its body and reaches the DOM only through the elements it is handed (self-contained.test.ts).
import type { RuntimeTarget } from '../../../core/motion/export.ts';

export interface TargetKit {
  resolve(target: RuntimeTarget, source: Element): Element[];
}

export function createTargets(): TargetKit {
  // a selector the page cannot read finds nothing rather than stopping the script
  const all = (root: ParentNode, selector: string): Element[] => {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };
  const one = (element: Element | null): Element[] => (element === null ? [] : [element]);

  function resolve(target: RuntimeTarget, source: Element): Element[] {
    const document = source.ownerDocument;
    switch (target.kind) {
      case 'self':
        return [source];
      case 'selector':
        return all(document, target.selector);
      case 'class':
        return all(document, `.${target.className}`);
      case 'children':
        return Array.from(source.children);
      case 'siblings':
        return source.parentElement === null ? [] : Array.from(source.parentElement.children).filter((sibling) => sibling !== source);
      case 'parent':
        return one(source.parentElement);
      case 'next':
        return one(source.nextElementSibling);
      case 'previous':
        return one(source.previousElementSibling);
      case 'descendants':
        return all(source, `.${target.className}`);
      case 'ancestor':
        return one(source.parentElement === null ? null : source.parentElement.closest(`.${target.className}`));
    }
  }

  return { resolve };
}
