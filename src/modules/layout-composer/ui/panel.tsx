// The Layout Composer's sidebar view (manifest/layout.json panel "layout-composer", region layout-composer-panel):
// the container composed and what the layout predicts it becomes (spec "Prediction"), the tool and the lens
// (layout.view), the selected regions' properties (layout.configure, spec "Intent Inspector"), how the group is
// arranged (layout.interpret), what changes at the screen size the canvas shows (layout.respond), delete and Done.
// Every control is the door the manifest declares; nothing here changes state but through them.
import { useEffect, useRef, type ReactNode } from 'react';
import { locate } from '../../../core/document/model.ts';
import type { DispatchResult } from '../../../core/store/store.ts';
import type { CommandId, MessageId } from '../../../generated/ids.ts';
import { manifest, type DoorEntry } from '../../../manifest/runtime.ts';
import { DoorControl, useDoor } from '../../../editor/doors/door.tsx';
import { markFieldKept, recordFieldInput } from '../../../editor/input/drafts.ts';
import { useEditorState, useStore } from '../../../editor/store.ts';
import { useT } from '../../../editor/text.ts';
import { activeBreakpoint } from '../../../editor/view/breakpoints.ts';
import { STROKE_MODES } from '../gestures/recognize.ts';
import { predict } from '../intent/analysis.ts';
import { ALIGNMENTS, DISTRIBUTIONS, SEMANTICS, SIZINGS, childrenOf, findRegion, preferenceKey, type Region } from '../intent/model.ts';
import { recordOf } from '../host/record.ts';
import { composerOf } from '../host/state.ts';
import { LENSES } from './scene.ts';
import './composer.css';

const control = (name: string): DoorEntry | undefined => manifest.doors.find((d) => d.door.kind === 'panel-control' && d.door.panel === 'layout-composer' && d.door.control === name);
const DONE = control('layout-done');
const TOOL = control('layout-tool');
const LENS = control('layout-lens');
const DELETE = control('layout-delete-button');
const NAME = control('layout-name');
const SEMANTIC = control('layout-semantic');
const WIDTH = control('layout-width');
const HEIGHT = control('layout-height');
const PADDING = control('layout-padding');
const ALIGNMENT = control('layout-alignment');
const DISTRIBUTION = control('layout-distribution');
const STRATEGY = control('layout-strategy');
const RESPONDS = ['layout-stack', 'layout-unstack', 'layout-hide', 'layout-show'].map(control).filter((d): d is DoorEntry => d !== undefined);
const COLUMNS = control('layout-columns');
const STRATEGIES = ['auto', 'grid', 'flex', 'fixed', 'proportional', 'masonry'] as const;

// A text field of a door: what it holds is kept on Enter or when the focus leaves it, as its command's `value`.
function DoorField({ entry, value, type = 'text' }: { readonly entry: DoorEntry; readonly value: string; readonly type?: 'text' | 'number' }) {
  const store = useStore();
  const t = useT();
  const field = useRef<HTMLInputElement>(null);
  const label = t(entry.door.labelKey as MessageId);
  const door = useDoor(entry, {}, label);
  useEffect(() => {
    if (field.current === null || document.activeElement === field.current) return;
    field.current.value = value;
    markFieldKept(field.current, value);
  }, [value]);
  // what is typed is a draft until it is kept (input/drafts.ts): Ctrl+Z undoes the typing first, then the document
  const keep = () => {
    const input = field.current;
    if (input === null || !door.available || input.value === (input.dataset.shown ?? value)) return;
    (store.dispatch as (id: CommandId, args: unknown) => DispatchResult)(entry.command.id, { ...entry.door.args, value: input.value });
    markFieldKept(input, input.value);
  };
  return (
    <form className="layout-panel__field" data-door={entry.ref} data-args={JSON.stringify(entry.door.args)} title={door.title} onSubmit={(event) => { event.preventDefault(); keep(); }}>
      <label className="layout-panel__label">{label}</label>
      <input ref={field} className="input" type={type} min={type === 'number' ? 1 : undefined} defaultValue={value} aria-label={label} disabled={!door.available} spellCheck={false} onBlur={keep} onInput={(event) => recordFieldInput(event.currentTarget, event.nativeEvent)} data-key-context="command-field" />
    </form>
  );
}

// A row of segments, one per value, each the door with that value; the one the regions hold is current.
function Segments({ entry, values, current, words, arg = 'value' }: { readonly entry: DoorEntry; readonly values: readonly string[]; readonly current: string | null; readonly words: (value: string) => string; readonly arg?: string }) {
  const t = useT();
  return (
    <div className="layout-panel__group">
      <span className="layout-panel__label">{t(entry.door.labelKey as MessageId)}</span>
      <div className="segmented" role="group" aria-label={t(entry.door.labelKey as MessageId)}>
        {values.map((value) => (
          <DoorControl key={value} entry={entry} args={{ [arg]: value }} current={current === value} label={words(value)}>
            <span className="door__label">{words(value)}</span>
          </DoorControl>
        ))}
      </div>
    </div>
  );
}

function RegionSection({ regions }: { readonly regions: readonly Region[] }) {
  const t = useT();
  const first = regions[0] as Region;
  const same = <T,>(read: (r: Region) => T): T | null => (regions.every((r) => read(r) === read(first)) ? read(first) : null);
  return (
    <section className="layout-panel__section" aria-label={t('layout.panel.region')}>
      <span className="layout-panel__heading">{t('layout.panel.region')}</span>
      {NAME === undefined || regions.length !== 1 ? null : <DoorField entry={NAME} value={first.name} />}
      {SEMANTIC === undefined || regions.some((r) => r.kind === 'content') ? null : <Segments entry={SEMANTIC} values={SEMANTICS} current={same((r) => r.semantic)} words={(v) => t(`layout.word.${v}` as MessageId)} />}
      {WIDTH === undefined ? null : <Segments entry={WIDTH} values={SIZINGS} current={same((r) => r.width.mode)} words={(v) => t(`layout.word.${v}` as MessageId)} />}
      {HEIGHT === undefined ? null : <Segments entry={HEIGHT} values={SIZINGS} current={same((r) => r.height.mode)} words={(v) => t(`layout.word.${v}` as MessageId)} />}
      {PADDING === undefined || regions.some((r) => r.kind === 'content') ? null : <DoorField entry={PADDING} value={String(same((r) => r.layout?.padding ?? null) ?? '')} type="number" />}
      {ALIGNMENT === undefined ? null : <Segments entry={ALIGNMENT} values={ALIGNMENTS} current={same((r) => r.layout?.alignment ?? null)} words={(v) => t(`layout.alignment.${v}` as MessageId)} />}
      {DISTRIBUTION === undefined ? null : <Segments entry={DISTRIBUTION} values={DISTRIBUTIONS} current={same((r) => r.layout?.distribution ?? null)} words={(v) => t(`layout.distribution.${v}` as MessageId)} />}
    </section>
  );
}

export function LayoutPanel(): ReactNode {
  const t = useT();
  const composer = useEditorState((s) => composerOf(s.ui));
  const container = useEditorState((s) => (composer === null ? null : (locate(s.document, composer.target)?.node ?? null)));
  const breakpoint = useEditorState((s) => activeBreakpoint(s.ui));
  const record = container === null ? null : recordOf(container);
  if (composer === null || container === null || record === null) {
    return (
      <section className="view layout-panel" data-region="layout-composer-panel" aria-label={t('panel.layoutComposer')}>
        <div className="view__title">{t('panel.layoutComposer')}</div>
        <p className="layout-panel__text">{t('layout.panel.idle')}</p>
      </section>
    );
  }
  const regions = composer.selection.map((id) => findRegion(record.intent, id)).filter((r): r is Region => r !== undefined);
  const names = regions.map((r) => r.name);
  // the group the arrangement is about: the one selected region's children, else the selection's group, else the top
  const one = regions.length === 1 ? (regions[0] as Region) : undefined;
  const group = one !== undefined && childrenOf(record.intent, one.id).length > 0 ? one.id : (regions[0]?.parent ?? null);
  const groupName = group === null ? container.name : (findRegion(record.intent, group)?.name ?? container.name);
  const prediction = predict(record.intent, group);
  const strategy = record.intent.preferences?.[preferenceKey(group)] ?? 'auto';
  return (
    <section className="view layout-panel" data-region="layout-composer-panel" aria-label={t('panel.layoutComposer')}>
      <div className="view__title">{t('layout.panel.container', { name: container.name })}</div>
      <p className="layout-panel__prediction" data-layout-prediction={prediction.key}>
        {t(prediction.key as MessageId, Object.fromEntries(Object.entries(prediction.params).map(([name, value]) => [name, name === 'sizing' && typeof value === 'string' && !value.endsWith('px') ? t(`layout.word.${value}` as MessageId) : value])))}
      </p>
      {TOOL === undefined ? null : <Segments entry={TOOL} values={STROKE_MODES} current={composer.tool} words={(v) => t(`layout.tool.${v}` as MessageId)} arg="tool" />}
      {LENS === undefined ? null : <Segments entry={LENS} values={LENSES} current={composer.lens} words={(v) => t(`layout.lens.${v}` as MessageId)} arg="lens" />}
      <p className="layout-panel__text" data-layout-selection={composer.selection.join(' ')}>
        {names.length === 0 ? t('layout.panel.noSelection') : t('layout.panel.selection', { names: names.join(', ') })}
      </p>
      {regions.length === 0 ? null : <RegionSection regions={regions} />}
      {STRATEGY === undefined ? null : (
        <section className="layout-panel__section" aria-label={t('layout.panel.arrangement', { name: groupName })}>
          <span className="layout-panel__heading">{t('layout.panel.arrangement', { name: groupName })}</span>
          <Segments entry={STRATEGY} values={STRATEGIES} current={strategy} words={(v) => t(`layout.strategy.${v}` as MessageId)} arg="strategy" />
        </section>
      )}
      <section className="layout-panel__section" aria-label={t('layout.panel.screen')}>
        <span className="layout-panel__heading">{t('layout.panel.screen')}</span>
        {breakpoint.base ? (
          <p className="layout-panel__text">{t('layout.respond.base')}</p>
        ) : (
          <>
            <p className="layout-panel__text">{t('layout.respond.at', { breakpoint: t(breakpoint.labelKey as MessageId), width: breakpoint.width })}</p>
            <div className="layout-panel__actions">
              {RESPONDS.map((entry) => (
                <DoorControl key={entry.ref} entry={entry} />
              ))}
            </div>
            {COLUMNS === undefined ? null : <DoorField entry={COLUMNS} value="" type="number" />}
          </>
        )}
      </section>
      <p className="layout-panel__text">{t('layout.panel.help')}</p>
      <div className="layout-panel__actions">
        {DELETE === undefined ? null : <DoorControl entry={DELETE} />}
        {DONE === undefined ? null : <DoorControl entry={DONE} />}
      </div>
    </section>
  );
}
