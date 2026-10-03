// checks.applyFix (spec accessibility-checks 5; the plan's stage 6, the audit's AUD-16): the automatic fix a check offers
// beside its issue, run on the element the issue is about by the owner of what it changes, as manifest/checks.json
// declares it:
//  - "insert": the palette entry at the end of the element (a form with no submit button takes a button, which the
//    export writes as its submit; element.insert, with its placement, its lock and the content model's rules);
//  - "next-level": a heading that skips a level takes the level after the heading before it (element.setTag);
//  - "reveal": the element selected and its attribute's field opened in Settings, the focus in it (inspector.reveal):
//    the Alt text, the Title, the Source, the address the person writes.
// An issue the document no longer has (fixed meanwhile, the element gone) is refused as stale. The language of a page,
// a button's type and an input's type are no issues to fix: the export writes them (spec export-clean).
import { message, type Outcome } from '../../core/commands/registry.ts';
import { registerHandler } from '../../core/commands/registry.ts';
import { checksOf } from '../../core/a11y/checks.ts';
import { locate, type NodeId } from '../../core/document/model.ts';
import { setTagCommand } from '../../core/elements/tag.ts';
import { insertCommand } from '../../core/structure/insert.ts';
import { manifest } from '../../manifest/runtime.ts';
import type { EditorUi } from '../state.ts';
import { revealField } from '../inspector/sections.ts';

export const fixCheck = registerHandler<'checks.applyFix', EditorUi>('checks.applyFix', (context, { target, rule }): Outcome<EditorUi> => {
  const { state } = context;
  const issue = checksOf(state.document, manifest.interactions.checks).find((one) => one.node === target && one.rule === rule);
  const fix = manifest.checks.fixes.find((one) => one.rule === rule);
  const at = locate(state.document, target as NodeId);
  if (issue === undefined || fix === undefined || at === null) return { kind: 'refused', message: message('status.stale') };
  const on = (selection: readonly NodeId[]) => ({ ...context, state: { ...state, selection: [...selection] } });
  switch (fix.kind) {
    case 'insert':
      return insertCommand.run(on([]) as never, { entry: fix.entry, parent: at.node.id, index: at.node.children.length } as never) as Outcome<EditorUi>;
    case 'next-level': {
      const done = setTagCommand.run(on([at.node.id]) as never, { tag: `h${issue.level ?? 1}` } as never) as Outcome<EditorUi>;
      return done.kind === 'change' ? { ...done, selection: [at.node.id] } : done;
    }
    case 'reveal': {
      const done = revealField.run(on([at.node.id]), { attribute: fix.attribute } as never);
      return done.kind === 'change' ? { ...done, selection: [at.node.id] } : done;
    }
  }
});
