// Identity repair for a deep copy of document trees. The copy makers choose names and styles; this one pass owns
// the identities shared by all of them: HTML ids, references inside the copied group and interaction targets.
import { allNodes, type DocNode, type DocumentJson, type NodeId } from './model.ts';
import { referenceHtmlOf } from '../elements/references.ts';
import { mapInlineLinks } from '../text/inline.ts';

type Pair = { readonly source: DocNode; readonly copy: DocNode };

const IDREF_LISTS = new Set(['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'headers']);
const IDREF_SINGLES = new Set(['aria-activedescendant', 'list']);

export function refreshCopiedIdentities(document: DocumentJson, pairs: readonly Pair[], regenerateHtmlIds: boolean | 'collisions' = true): DocNode[] {
  const occupied = new Set([...allNodes(document)].map((node) => node.attributes.id).filter((id): id is string => typeof id === 'string' && id !== ''));
  const nodeIds = new Map<string, NodeId>();
  const htmlIds = new Map<string, string>();

  const visitPairs = (source: DocNode, copy: DocNode): void => {
    nodeIds.set(source.id, copy.id);
    const htmlId = source.attributes.id;
    if (regenerateHtmlIds && typeof htmlId === 'string' && htmlId !== '' && (regenerateHtmlIds !== 'collisions' || occupied.has(htmlId))) {
      let candidate = `${htmlId}-copy`;
      for (let n = 2; occupied.has(candidate); n += 1) candidate = `${htmlId}-copy-${n}`;
      occupied.add(candidate);
      htmlIds.set(htmlId, candidate);
    }
    if (typeof htmlId === 'string') occupied.add(htmlId);
    if (source.children.length !== copy.children.length) throw new Error('refreshCopiedIdentities: the copy changed the tree shape');
    source.children.forEach((child, index) => {
      const copiedChild = copy.children[index];
      if (copiedChild === undefined) throw new Error('refreshCopiedIdentities: a copied child is missing');
      visitPairs(child, copiedChild);
    });
  };
  pairs.forEach(({ source, copy }) => visitPairs(source, copy));

  const reference = (value: string): string => {
    const fragment = value.startsWith('#');
    const named = fragment ? value.slice(1) : value;
    const replacement = nodeIds.get(named) ?? htmlIds.get(named);
    return replacement === undefined ? value : fragment ? `#${replacement}` : replacement;
  };
  const repair = (copy: DocNode): DocNode => {
    const attributes = Object.fromEntries(Object.entries(copy.attributes).map(([name, value]) => [
      name,
      name === 'id' && typeof value === 'string' ? (htmlIds.get(value) ?? value) :
        typeof value === 'string' && referenceHtmlOf(name) !== undefined ? reference(value) : value,
    ])) as DocNode['attributes'];
    const customAttributes = copy.customAttributes === undefined ? undefined : Object.fromEntries(
      Object.entries(copy.customAttributes).map(([name, value]) => [name,
        IDREF_LISTS.has(name) ? value.split(/\s+/).map((part) => htmlIds.get(part) ?? part).join(' ') :
          IDREF_SINGLES.has(name) ? (htmlIds.get(value) ?? value) : value,
      ]),
    );
    const interactions = copy.interactions?.map((interaction) => {
      const target = interaction.target === undefined ? undefined : nodeIds.get(interaction.target);
      return target === undefined ? interaction : { ...interaction, target };
    });
    const layerColors = copy.layerColors?.map((colour) => ({ ...colour, node: nodeIds.get(colour.node) ?? colour.node }));
    const inline = copy.inline === undefined ? undefined : mapInlineLinks(copy.inline, href => href.startsWith('#') ? reference(href) : href);
    return { ...copy, attributes, ...(customAttributes === undefined ? {} : { customAttributes }),
      ...(interactions === undefined ? {} : { interactions }), ...(layerColors === undefined ? {} : { layerColors }),
      ...(inline === undefined ? {} : { inline }),
      children: copy.children.map(repair) };
  };
  return pairs.map(({ copy }) => repair(copy));
}
