// The confirmation a dispatch waits for (PRODUCT.md §5, "Store and dispatch": state.confirmation, asked by a
// command whose manifest entry has a confirmation, such as File › Open over a page that holds work): the question and
// its two answers, in the manifest's words, in a modal dialog over the editor. The answer goes back to the store
// (store.answer), which runs the waiting dispatch or drops it. Its two buttons are that door's run going on, not doors
// of their own (data-local).
// It is a modal dialog as every other (docs/PRODUCT.md, The interface contract): the focus goes to Cancel, the answer
// that loses nothing, and stays inside it (Tab past the last button comes back to the first); Escape, in its dialog key
// context, is a dismissal, which answers Cancel; and once answered the focus goes back to what had it when it was
// asked.
import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useEditorState, useStore } from '../store.ts';
import { MESSAGE_IDS, type MessageId } from '../../generated/ids.ts';
import { pluralForm } from '../../i18n/index.ts';
import { useLocale, useT } from '../text.ts';
import { DIALOG_KEYS } from './dialog.tsx';

export function Confirmation() {
  const waiting = useEditorState((s) => s.confirmation ?? null);
  // each question asked draws its own dialog: its opening, its focus and its answer are its own
  return waiting === null ? null : <Asked key={`${waiting.command}:${JSON.stringify(waiting.args)}`} />;
}

function Asked() {
  const t = useT();
  const store = useStore();
  const waiting = useEditorState((s) => s.confirmation ?? null);
  const dismissals = useEditorState((s) => s.ui.overlays.dismissals);
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  // the dismissals when the question was asked, and where the focus was: a later dismissal (Escape) answers Cancel
  const [askedAt] = useState(dismissals);
  const [returnTo] = useState<Element | null>(() => document.activeElement);
  useEffect(() => {
    cancel.current?.focus();
    return () => {
      if (returnTo instanceof HTMLElement && returnTo !== document.body && returnTo.isConnected) returnTo.focus();
    };
  }, [returnTo]);
  useEffect(() => {
    if (waiting !== null && dismissals !== askedAt) store.answer(false);
  }, [waiting, dismissals, askedAt, store]);
  if (waiting === null) return null;
  // the question in the command's words, its placeholders filled by the command, in its plural form when it has one
  const params = waiting.params ?? {};
  const count = params.count;
  const plural = typeof count === 'number' ? (`${waiting.message}.${pluralForm(locale, count)}` as MessageId) : null;
  const question = plural !== null && (MESSAGE_IDS as readonly string[]).includes(plural) ? plural : waiting.message;
  // the focus stays in the dialog: an edge after the last button sends it to the first, one before the first to the
  // last
  const wrap = (event: FocusEvent<HTMLSpanElement>) => {
    const buttons = [...(box.current?.querySelectorAll<HTMLElement>('button') ?? [])];
    (event.currentTarget.dataset.edge === 'first' ? buttons[0] : buttons[buttons.length - 1])?.focus();
  };
  return (
    <div className="confirmation" data-confirmation-dialog>
      <div className="confirmation__scrim" />
      <span tabIndex={0} data-edge="last" onFocus={wrap} />
      <div ref={box} className="confirmation__box" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-message" data-key-context={DIALOG_KEYS}>
        <p id="confirmation-message" className="confirmation__message">
          {t(question, params)}
        </p>
        <div className="confirmation__actions">
          <button ref={cancel} type="button" className="door door--button" data-local="confirmation" data-confirmation="cancel" onClick={() => store.answer(false)}>
            <span className="door__label">{t(waiting.cancel)}</span>
          </button>
          <button type="button" className="door door--primary" data-local="confirmation" data-confirmation="confirm" onClick={() => store.answer(true)}>
            <span className="door__label">{t(waiting.confirm)}</span>
          </button>
        </div>
      </div>
      <span tabIndex={0} data-edge="first" onFocus={wrap} />
    </div>
  );
}
