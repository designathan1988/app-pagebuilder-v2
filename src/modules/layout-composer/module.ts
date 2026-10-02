// The Layout Composer as a module (src/app/modules.ts installs it): the handlers of its commands
// (manifest/commands/layout-composer.json) and its predicate, and the validator of what it keeps on the document. No React, no DOM: the
// command table and the scenario runner read this in Node. Its editor side is view.ts.
import { configureLayout, deleteLayout, enterLayout, interpretLayout, layoutComposing, leaveLayout, respondLayout, selectLayout, strokeLayout, viewLayout } from './host/handlers.ts';
import { NAMESPACE, recordProblem } from './host/record.ts';

export const LAYOUT_COMPOSER = {
  // each handler names its own command (registerHandler): the command table files them under it (app/modules.ts)
  handlers: [enterLayout, leaveLayout, strokeLayout, selectLayout, deleteLayout, viewLayout, configureLayout, interpretLayout, respondLayout],
  predicates: { layoutComposing },
  authoring: { namespace: NAMESPACE, validator: recordProblem },
} as const;
