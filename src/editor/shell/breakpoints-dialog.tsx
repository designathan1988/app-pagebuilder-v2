// The Breakpoints dialog (DESIGN.md "Regions": breakpoints-dialog; spec project-breakpoints), open while the editor
// state says so (ui.dialog; View ▸ Breakpoints… and the sliders after the frame's tabs): one row per breakpoint of
// the project's table, widest first, with its name and the widest screen it holds. Enter or leaving a field keeps
// what was typed (breakpoints.rename, breakpoints.setWidth: one undo step each); the trash removes the breakpoint
// (breakpoints.remove; the base has none); Add makes one at the width the canvas shows (breakpoints.add). A refused
// value goes back to what the table holds, and the status bar says why.
import { useEffect, useRef } from 'react';
import { isFeatureBuilt } from '../../app/features.ts';
import { breakpointName, breakpointsOf, type ProjectBreakpoint } from '../../core/document/breakpoints.ts';
import type { DispatchResult } from '../../core/store/store.ts';
import type { CommandId, FeatureId } from '../../generated/ids.ts';
import type { DoorEntry } from '../../manifest/runtime.ts';
import { DoorControl, useDoor } from '../doors/door.tsx';
import { doorSlots } from '../doors/placement.ts';
import { useEditorState, useStore } from '../store.ts';
import { useT } from '../text.ts';
import { viewportWidth } from '../view/breakpoints.ts';
import { DIALOG_KEYS, ModalDialog } from './dialog.tsx';

const REGION = 'breakpoints-dialog';
const DIALOG = 'breakpoints';
const DOORS = doorSlots(REGION);
// the fields: the argument each keeps besides the breakpoint, a text (the name) or a number (the width)
const keptArg = (entry: DoorEntry): string => Object.keys(entry.command.args).find((name) => entry.command.args[name]?.type !== 'breakpoint') ?? '';
const isNumber = (entry: DoorEntry): boolean => entry.command.args[keptArg(entry)]?.type === 'number';
const FIELDS = DOORS.filter((d) => d.door.kind === 'panel-control' && d.door.drawnAs === 'field');
const NAME = FIELDS.find((d) => !isNumber(d));
const WIDTH = FIELDS.find(isNumber);
// the trash: the door that takes the breakpoint alone; Add: the one that takes none
const REMOVE = DOORS.find((d) => Object.keys(d.command.args).length === 1 && d.command.args[Object.keys(d.command.args)[0] ?? '']?.type === 'breakpoint');
const ADD = DOORS.find((d) => Object.values(d.command.args).every((a) => a.optional));

const built = (entry: DoorEntry | undefined): boolean => entry !== undefined && isFeatureBuilt(entry.door.feature as FeatureId);

export function BreakpointsDialog() {
  const open = useEditorState((s) => s.ui.dialog === DIALOG);
  return open ? <OpenBreakpoints /> : null;
}

function OpenBreakpoints() {
  const t = useT();
  const table = useEditorState((s) => breakpointsOf(s.document));
  const width = useEditorState((s) => viewportWidth(s));
  return (
    <ModalDialog region={REGION} titleKey="breakpoints.title" className="breakpoints-dialog">
      <div className="dialog__body">
        <p className="breakpoints-dialog__hint">{t('breakpoints.hint')}</p>
        <div className="breakpoints-dialog__table" role="table" aria-label={t('breakpoints.title')}>
          <div className="breakpoints-dialog__row breakpoints-dialog__row--head" role="row">
            <span role="columnheader">{t('breakpoints.name')}</span>
            <span role="columnheader">{t('breakpoints.width')}</span>
            <span role="columnheader" />
          </div>
          {table.map((breakpoint) => (
            <BreakpointRow key={breakpoint.id} breakpoint={breakpoint} />
          ))}
        </div>
        <footer className="dialog__footer">
          {ADD === undefined ? null : (
            <DoorControl entry={ADD} ready={built(ADD)} title={t('command.breakpoints.add')}>
              <span className="door__label">{t('breakpoints.addAt', { width })}</span>
            </DoorControl>
          )}
        </footer>
      </div>
    </ModalDialog>
  );
}

function BreakpointRow({ breakpoint }: { readonly breakpoint: ProjectBreakpoint }) {
  const t = useT();
  const name = breakpointName(breakpoint, t);
  return (
    <div className="breakpoints-dialog__row" role="row" data-breakpoint={breakpoint.id}>
      {NAME === undefined ? <span /> : <TableField entry={NAME} breakpoint={breakpoint} shown={name} label={`${t('breakpoints.name')}: ${name}`} />}
      {WIDTH === undefined ? <span /> : <TableField entry={WIDTH} breakpoint={breakpoint} shown={String(breakpoint.width)} label={`${t('breakpoints.width')}: ${name}`} />}
      {breakpoint.base ? (
        <span className="breakpoints-dialog__base">{t('breakpoints.base')}</span>
      ) : REMOVE === undefined ? (
        <span />
      ) : (
        <DoorControl entry={REMOVE} args={{ breakpoint: breakpoint.id }} ready={built(REMOVE)} title={`${t('command.breakpoints.remove')}: ${name}`} />
      )}
    </div>
  );
}

// A field of a row: what the table holds, again after a refusal or an undo; Enter or leaving it keeps what was typed
function TableField({ entry, breakpoint, shown, label }: { readonly entry: DoorEntry; readonly breakpoint: ProjectBreakpoint; readonly shown: string; readonly label: string }) {
  const arg = keptArg(entry);
  const numeric = isNumber(entry);
  const store = useStore();
  const field = useDoor(entry, { breakpoint: breakpoint.id }, undefined, built(entry));
  const input = useRef<HTMLInputElement>(null);
  // after a value was kept (or refused), the field shows what the table holds, even while it keeps the focus
  const kept = useRef(false);
  const said = useEditorState((s) => s.message);
  useEffect(() => {
    if (input.current !== null && (kept.current || document.activeElement !== input.current)) input.current.value = shown;
    kept.current = false;
  }, [shown, said]);
  const keep = (typed: string) => {
    if (!field.available || typed.trim() === shown) return;
    const value = numeric ? (typed.trim() === '' ? Number.NaN : Number(typed)) : typed;
    kept.current = true;
    (store.dispatch as (id: CommandId, args: unknown) => DispatchResult)(entry.command.id as CommandId, { ...entry.door.args, breakpoint: breakpoint.id, [arg]: value });
  };
  return (
    <form
      className="breakpoints-dialog__cell"
      role="cell"
      onSubmit={(event) => {
        event.preventDefault();
        keep(input.current?.value ?? '');
      }}
    >
      <input
        ref={input}
        className="input"
        type="text"
        defaultValue={shown}
        inputMode={numeric ? 'numeric' : undefined}
        disabled={!field.available}
        aria-label={label}
        title={field.title}
        spellCheck={false}
        autoComplete="off"
        data-door={entry.ref}
        data-args={JSON.stringify({ breakpoint: breakpoint.id })}
        data-key-context={DIALOG_KEYS}
        onBlur={(event) => keep(event.currentTarget.value)}
      />
    </form>
  );
}
