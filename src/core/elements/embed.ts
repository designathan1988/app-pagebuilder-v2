// element.setEmbedMarkup (INVENTORY.md, owners; feature embed-html): the markup of the one selected Embed,
// third-party widget code stored as it is typed or pasted. On the editing canvas the renderer shows it inside a
// sandboxed frame where its scripts never run; the export writes it verbatim at its place. The same markup records
// nothing; a locked element keeps its markup (spec lock-element).
import { message, registerHandler, type Outcome } from '../commands/registry.ts';
import { locate } from '../document/model.ts';
import { lockRefusal } from '../nodes/flags.ts';

// Whether a markup runs code in the published page: a <script>, an event attribute (on…) or an address that runs code
// (an src or href of javascript:). The editor says so beside the field (the user's real-use audit, A3.6): the export
// writes the code as it is, and the sandboxed canvas never runs it.
export function holdsExecutableCode(markup: string): boolean {
  if (/<script\b/i.test(markup) || /\son[a-z]+\s*=/i.test(markup)) return true;
  return /\b(?:src|href)\s*=\s*["']?\s*javascript:/i.test(markup);
}

export const setEmbedMarkupCommand = registerHandler('element.setEmbedMarkup', ({ state, rules }, { markup, target }): Outcome<never> => {
  const id = target ?? (state.selection.length === 1 ? state.selection[0] : undefined);
  if (id === undefined) return { kind: 'refused', message: message('status.needsSingleSelection') };
  const at = locate(state.document, id);
  if (at === null) throw new Error(`element.setEmbedMarkup: the document has no node ${id}`);
  if (rules.elements.get(at.node.type)?.content !== 'markup') return { kind: 'refused', message: message('status.element.notApplicable', { command: { key: 'command.setEmbedMarkup' }, name: at.node.name }) };
  const locked = lockRefusal(state.document, at.node.id, 'status.locked.edit');
  if (locked !== null) return { kind: 'refused', message: locked };
  const text = String(markup);
  const said = message('status.embed.set', { name: at.node.name });
  if (at.node.text === text) return { kind: 'change', message: said };
  return { kind: 'change', patches: [{ op: 'replace', path: [...at.path, 'text'], value: text }], message: said };
});
