// The nesting grammar, at its one owner (spec nesting-grammar-structure; PRODUCT.md §5, the content model): the
// rules of where an element may sit live in src/core/elements/content-model.ts, and every path that places one asks
// them. One table of cases runs through every path — wrap, promote, move, tag switch and insert — and each path
// refuses with the rule's own message and leaves the document as it was. The table names the message key, so a path
// that invented its own wording (or its own rule) fails here.
import { describe, expect, it } from 'vitest';
import type { NodeId } from '../../generated/commands.ts';
import type { MessageId } from '../../generated/ids.ts';
import { translate } from '../../i18n/index.ts';
import { manifest } from '../../manifest/runtime.ts';
import type { HandlerContext } from '../commands/registry.ts';
import type { DocNode, DocumentJson } from '../document/model.ts';
import { rulesFromManifest } from '../document/validate.ts';
import { EMPTY_HISTORY } from '../history/history.ts';
import { manualClock } from '../ports/clock.ts';
import { sequentialIds } from '../ports/ids.ts';
import { anyCss } from '../ports/css.ts';
import { noLayout } from '../ports/layout.ts';
import { deepFreeze } from '../store/store.ts';
import { setTagCommand } from '../elements/tag.ts';
import { insertCommand } from './insert.ts';
import { moveToCommand, promoteCommand } from './move.ts';
import { wrapRowCommand } from './wrap.ts';

const RULES = rulesFromManifest(manifest.elements, manifest.properties, manifest.html);
const node = (id: string, type: string, tag: string, children: readonly DocNode[] = []): DocNode => ({ id: id as NodeId, type: type as DocNode['type'], name: id, tag, attributes: {}, classes: [], styles: {}, text: null, children: [...children] });

// One document holding every case: a list that takes only items, a header that excludes a main, a link that takes no
// interactive content, and a section that holds a main (so it cannot become a header).
const DOC: DocumentJson = deepFreeze({
  version: 1,
  pages: [
    {
      id: 'p',
      name: 'Home',
      file: 'index.html',
      tree: node('Page', 'page', 'body', [
        node('List', 'list', 'ul', [node('One', 'listItem', 'li')]),
        node('Head', 'header', 'header', [node('Intro', 'paragraph', 'p')]),
        node('Anchor', 'link', 'a', [node('Text', 'paragraph', 'p'), node('Inside', 'div', 'div')]),
        node('Section', 'section', 'section', [node('Main', 'main', 'main')]),
        node('Box', 'div', 'div', [node('Inner', 'link', 'a')]),
      ]),
    },
  ],
}) as unknown as DocumentJson;

type Command = typeof moveToCommand | typeof promoteCommand | typeof wrapRowCommand | typeof setTagCommand | typeof insertCommand;
function run(command: Command, selection: readonly string[], args: unknown = {}) {
  const context = {
    state: { document: DOC, selection: selection as NodeId[], history: EMPTY_HISTORY, message: null, ui: undefined as never },
    clock: manualClock(),
    ids: sequentialIds('new'),
    rules: RULES,
    words: (key: MessageId) => translate('en', key),
    layout: noLayout,
    css: anyCss,
  } satisfies HandlerContext<never>;
  return command.run(context, args as never);
}

// a path that places an element, named by the command it runs and the arguments it hands
interface Path {
  readonly name: string;
  readonly command: Command;
  readonly selection: readonly string[];
  readonly args?: unknown;
  readonly key: MessageId;
}
const MOVE = 'Intro';
const paths: readonly (Path & { readonly blocked: string })[] = [
  { name: 'a paragraph into a list', blocked: 'ul takes only li', command: moveToCommand, selection: [MOVE], args: { parent: 'List', index: 0 }, key: 'status.refused.onlyAccepts' },
  { name: 'a list item out to the page', blocked: 'li exists only in a list', command: promoteCommand, selection: ['One'], key: 'status.refused.requiresParent' },
  { name: 'a main into a header', blocked: 'a header excludes a main', command: moveToCommand, selection: ['Main'], args: { parent: 'Head', index: 0 }, key: 'status.refused.notInside' },
  { name: 'a box holding a link into a link', blocked: 'a link takes no interactive content', command: moveToCommand, selection: ['Box'], args: { parent: 'Anchor', index: 0 }, key: 'status.refused.noChildren' },
  { name: 'a box holding a link beside a link', blocked: 'a link takes no interactive content, at any depth', command: moveToCommand, selection: ['Box'], args: { parent: 'Inside', index: 0 }, key: 'status.refused.interactiveInside' },
  { name: 'a section with a main switched to a header', blocked: 'a header excludes a main', command: setTagCommand, selection: ['Section'], args: { tag: 'header' }, key: 'status.refused.notInside' },
  { name: 'a paragraph inserted into a list', blocked: 'ul takes only li', command: insertCommand, selection: [], args: { entry: 'paragraph', parent: 'List' }, key: 'status.refused.onlyAccepts' },
  { name: 'a list item wrapped in a row inside the list', blocked: 'ul takes only li', command: wrapRowCommand, selection: ['One'], key: 'status.refused.onlyAccepts' },
];

describe('the nesting grammar, through every path that places an element', () => {
  for (const path of paths) {
    it(`refuses ${path.name} (${path.blocked}) with its rule's own message`, () => {
      const outcome = run(path.command, path.selection, path.args);
      expect(outcome.kind, `${path.name}: refused`).toBe('refused');
      expect(outcome.kind === 'refused' ? outcome.message.key : null, `${path.name}: the rule's message`).toBe(path.key);
      // and nothing changed: a refusal carries no patches at all
      expect(JSON.stringify(outcome), `${path.name}: no patch`).not.toContain('"patches"');
    });
  }
  it('takes the same case everywhere it is allowed', () => {
    // the control: the same paragraph into the page is a change, so the refusals above are the rule's, not the path's
    const outcome = run(moveToCommand, ['Intro'], { parent: 'Page', index: 0 });
    expect(outcome.kind).toBe('change');
  });
});
