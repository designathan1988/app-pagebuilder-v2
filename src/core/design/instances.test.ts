// @vitest-environment happy-dom
// The audit's AUD-04: Remove wrapper on an instance, Move out of parent on a part of an instance, and Make child of
// previous layer on an instance left parts outside their instance or an instance inside another, which the model
// refuses (42 breaches over every node of every fixture). Every structure command, on every node of every fixture that
// holds instances, on the editor's own store frozen as in development (where a breach throws): no breach, and each
// refusal of the instance rules said in words.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { walk, type DocumentJson } from '../document/model.ts';
import { manualClock } from '../ports/clock.ts';
import { sequentialIds } from '../ports/ids.ts';
import { InvalidStateError } from '../store/store.ts';
import type { CommandId } from '../../generated/ids.ts';
import { createEditorStore } from '../../editor/store.ts';
import { messageText } from '../../editor/text.ts';

const FIXTURES = ['catalog', 'catalog-edited', 'catalog-variants', 'content-menu-list', 'content-site-shared'];
const COMMANDS = ['element.promote', 'element.unwrap', 'element.nestIntoPrevious', 'element.wrapRow', 'element.wrapColumn', 'element.wrapContainer', 'element.wrapGrid', 'element.duplicate', 'element.delete', 'element.moveUp', 'element.moveDown', 'components.detach'] as const;

const memory = (): { read(): string | null; write(text: string): void } => {
  let held: string | null = null;
  return { read: () => held, write: (text) => void (held = text) };
};
const storeOn = (document: DocumentJson) =>
  createEditorStore({ storage: memory(), workspace: memory(), clock: manualClock(1_000_000), ids: sequentialIds('i'), restored: { document, selection: [] }, ports: { readOnly: () => false }, freeze: true });

describe('structure commands and component instances (AUD-04)', () => {
  it('never leave a part outside its instance nor an instance inside another', { timeout: 120_000 }, () => {
    const breaches: string[] = [];
    const refusals = new Set<string>();
    for (const name of FIXTURES) {
      const document = JSON.parse(fs.readFileSync(`manifest/features/fixtures/${name}.json`, 'utf8')) as DocumentJson;
      const ids = document.pages.flatMap((page) => [...walk(page.tree)].map((node) => node.id));
      for (const id of ids) {
        for (const command of COMMANDS) {
          const store = storeOn(document);
          store.dispatch('selection.select', { target: id as never });
          try {
            const answer = store.dispatch(command as CommandId, {} as never);
            if (answer.status === 'confirm') store.answer(true);
            const said = store.getState().message;
            if (answer.status === 'refused' && said !== null && said !== undefined && /^status\.(instance|unwrap\.instance)/.test(said.key)) refusals.add(messageText('en', said));
          } catch (error) {
            if (error instanceof InvalidStateError) breaches.push(`${name} ${id} ${command}: ${error.message.slice(0, 160)}`);
          }
        }
      }
    }
    expect(breaches).toEqual([]);
    // the rules said, in words a person can act on
    expect([...refusals].some((text) => /is part of the instance .* and stays in it\. Detach the instance first\./.test(text))).toBe(true);
    expect([...refusals].some((text) => /is an instance: its wrapper holds its parts\./.test(text))).toBe(true);
  });
});
