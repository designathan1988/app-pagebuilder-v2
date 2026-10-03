import { useEffect, useRef } from 'react';
import { importPageFiles } from '../../core/import/import.ts';
import type { MessageId } from '../../generated/ids.ts';
import { DoorControl } from '../doors/door.tsx';
import { doorSlots } from '../doors/placement.ts';
import { useEditorState } from '../store.ts';
import { useT } from '../text.ts';
import { ModalDialog } from './dialog.tsx';

const CHOICES = doorSlots('html-import');
export function HtmlImportDialog() {
  const request = useEditorState(s => s.ui.dialog === 'html-import' ? s.ui.htmlImport : undefined);
  const target = useEditorState(s => s.selection.length === 1 ? s.selection[0] : undefined);
  const message = useEditorState(s => s.message);
  const t = useT();
  const choices = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (request) choices.current?.querySelector<HTMLButtonElement>('[data-import-default] button')?.focus();
  }, [request]);
  if (!request) return null;
  return <ModalDialog region="html-import" titleKey="import.title" className="html-import">
    <div className="dialog__body">
      <p>{t('import.destinationHelp')}</p>
      <ul>{importPageFiles(request.files).map(file => <li key={file.name}>{file.name}</li>)}</ul>
      <div ref={choices} className="html-import__choices">
        {CHOICES.map(entry => {
          const destination = String(entry.door.args.destination);
          return <div key={entry.ref} className="html-import__choice" data-import-default={destination === 'page' ? '' : undefined}>
            <DoorControl entry={entry} args={target === undefined ? {} : { target }} {...(destination === 'page' ? { className: 'door--primary' } : {})} />
            <p>{t(`import.hint.${destination}` as MessageId)}</p>
          </div>;
        })}
      </div>
      {message && ((message.key.startsWith('status.import.') && message.key !== 'status.import.done') || message.key.startsWith('status.locked.')) ? <p role="alert">{t(message.key, message.params)}</p> : null}
    </div>
  </ModalDialog>;
}
