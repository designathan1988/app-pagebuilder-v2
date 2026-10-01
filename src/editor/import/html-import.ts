// Import destinations are editor UI; the existing core importer remains the only HTML/style writer.
import type { RegisteredHandler } from '../../core/commands/registry.ts';
import { importPageFiles } from '../../core/import/import.ts';
import type { EditorUi } from '../state.ts';

export function choosingImport(owner: RegisteredHandler<'project.importHtml', EditorUi>): RegisteredHandler<'project.importHtml', EditorUi> {
  return { ...owner, run(context, args) {
    // Destination controls carry only their choice; file bytes stay once in editor state, never in DOM attributes.
    const files = args.files.length > 0 ? args.files : (context.state.ui.htmlImport?.files ?? []);
    if (args.destination === undefined && importPageFiles(args.files).length > 0 && !args.files.some(f => f.error)) {
      return { kind: 'change', ui: { ...context.state.ui, dialog: 'html-import', htmlImport: { files: args.files } } };
    }
    const outcome = owner.run(context, { ...args, files });
    if (outcome.kind !== 'change') return outcome;
    const { dialog: _dialog, htmlImport: _request, ...ui } = outcome.ui ?? context.state.ui;
    void _dialog; void _request;
    return { ...outcome, ui };
  } };
}
