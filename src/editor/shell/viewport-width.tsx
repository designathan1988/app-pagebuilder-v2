// The width of the screen the canvas shows, typed or slid (view.setViewportWidth; spec breakpoints-switch): the
// keyboard's way to the width the frame's edge drags. It stands in the Breakpoints dialog (breakpoints-dialog.tsx):
// the frame's row holds only the breakpoints' tabs, as the canonical frame does (design/final .ftabs2).
import { useState } from 'react';
import type { CommandId } from '../../generated/ids.ts';
import type { DoorEntry } from '../../manifest/runtime.ts';
import { useDoor } from '../doors/door.tsx';
import { useEditorState, useStore } from '../store.ts';
import { viewportWidth } from '../view/breakpoints.ts';

export function ViewportWidth({ entry }: { readonly entry: DoorEntry }) {
  const store = useStore();
  const width = useEditorState((s) => viewportWidth(s));
  const door = useDoor(entry);
  const [draft, setDraft] = useState<string | null>(null);
  const keep = () => {
    if (draft === null) return;
    store.dispatch(entry.command.id as CommandId, { width: draft.trim() === '' ? NaN : Number(draft) });
    setDraft(null);
  };
  return (
    <form className="viewport-width" data-door={entry.ref} title={door.title} onSubmit={(event) => { event.preventDefault();
      keep();
    }}>
      <input className="input viewport-width__value" aria-label={door.label} inputMode="numeric" disabled={!door.available} value={draft ?? String(width)} onChange={(event) => setDraft(event.currentTarget.value)} onBlur={keep} />
      <input className="viewport-width__range" type="range" aria-label={door.label} min={320} max={7680} step={1} value={width} disabled={!door.available} onChange={(event) => store.dispatch(entry.command.id as CommandId, { width: Number(event.currentTarget.value) })} />
    </form>
  );
}
