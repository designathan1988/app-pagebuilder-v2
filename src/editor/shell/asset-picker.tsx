// The asset picker (ARCHITECTURE.md, Command owners; spec explorer-assets-use; the user's real-use audit, 7.3): the
// project's image files offered where a field that names a file is written. An image's Source shows a choose button
// (the door assetPicker.open) beside the field; it opens the picker over a shield, every image the project holds is an
// item (the door element.setAttribute#asset-picker-choose) that writes the field's attribute with the file's path as
// one undo step, and the close button, a click on the shield or Escape (keymap.ts, the context's key-escape door)
// leaves it. The picker's state is editor state (ui.assetPicker: the attribute it writes, or null); nothing of it is
// document state.
import { useEffect, useMemo, useRef } from 'react';
import { imageFiles, sizeLabel, type ProjectFile } from '../../core/files/files.ts';
import type { DispatchResult } from '../../core/store/store.ts';
import { DoorControl } from '../doors/door.tsx';
import { doorSlots } from '../doors/placement.ts';
import { useEditorState, useStore } from '../store.ts';
import { useOutsideLayer } from './outside-layer.ts';
import { useT } from '../text.ts';

const NO_FILES: readonly ProjectFile[] = [];

// the doors of the picker's region: the items that choose a file, and the close button (layout.json "asset-picker")
const PARTS = doorSlots('asset-picker');
const CHOOSE = PARTS.find((p) => p.door.kind === 'panel-control' && p.door.control === 'choose') ?? null;
const CLOSE = PARTS.find((p) => p.door.kind === 'panel-control' && p.door.control === 'close') ?? null;
// the key context the open picker names, so Escape is the keymap's (interactions.json keyContexts)
const PICKER_CONTEXT = 'asset-picker';

export function AssetPicker() {
  const t = useT();
  const store = useStore();
  const open = useEditorState((s) => s.ui.assetPicker);
  const held = useEditorState((s) => s.document.files ?? NO_FILES);
  const selection = useEditorState((s) => s.selection);
  const files = useMemo(() => imageFiles({ files: held } as never), [held]);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => { if (CLOSE) (store.dispatch as (id: string, args: unknown) => DispatchResult)(CLOSE.command.id, {}); };
  useOutsideLayer(panel, open !== null, close);
  // the picker takes the focus, so the keymap reads its context and Escape closes it
  useEffect(() => {
    if (open !== null) panel.current?.focus();
  }, [open]);
  if (open === null || CLOSE === null) return null;
  const target = selection[0];
  return (
    <div className="picker-shield">
      <div
        ref={panel}
        className="picker picker--assets"
        role="dialog"
        aria-label={t('assetPicker.title')}
        data-region="asset-picker"
        data-key-context={PICKER_CONTEXT}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="picker__label">{t('assetPicker.title')}</p>
        {files.length === 0 ? <p className="picker__warning" role="note">{t('assetPicker.empty')}</p> : null}
        <div className="picker__row" role="group" aria-label={t('assetPicker.title')} data-region="asset-picker-files">
          {CHOOSE === null || target === undefined
            ? null
            : files.map((file) => (
                <DoorControl key={file.path} entry={CHOOSE} args={{ target, [open.attribute]: file.path, value: file.path }} label={`${file.path} · ${sizeLabel(file)}`} current={false} />
              ))}
        </div>
        <div className="picker__actions">
          <DoorControl entry={CLOSE} />
        </div>
      </div>
    </div>
  );
}
