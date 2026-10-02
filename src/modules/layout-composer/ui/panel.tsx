// The Layout Composer's sidebar view (manifest/layout.json panel "layout-composer", region layout-composer-panel):
// the container composed, what the layout predicts it becomes (spec "Prediction"), the tool and the lens (the
// layout-tool and layout-lens segments of layout.view), the selection with its delete door, and Done (layout.leave).
// Every control is the door the manifest declares; nothing here changes state but through them.
import type { ReactNode } from 'react';
import { locate } from '../../../core/document/model.ts';
import type { MessageId } from '../../../generated/ids.ts';
import { manifest, type DoorEntry } from '../../../manifest/runtime.ts';
import { DoorControl } from '../../../editor/doors/door.tsx';
import { useEditorState } from '../../../editor/store.ts';
import { useT } from '../../../editor/text.ts';
import { STROKE_MODES } from '../gestures/recognize.ts';
import { predict } from '../intent/analysis.ts';
import { findRegion } from '../intent/model.ts';
import { recordOf } from '../host/record.ts';
import { composerOf } from '../host/state.ts';
import { LENSES } from './scene.ts';
import './composer.css';

const control = (name: string): DoorEntry | undefined => manifest.doors.find((d) => d.door.kind === 'panel-control' && d.door.panel === 'layout-composer' && d.door.control === name);
const DONE = control('layout-done');
const TOOL = control('layout-tool');
const LENS = control('layout-lens');
const DELETE = control('layout-delete-button');

export function LayoutPanel(): ReactNode {
  const t = useT();
  const composer = useEditorState((s) => composerOf(s.ui));
  const container = useEditorState((s) => (composer === null ? null : (locate(s.document, composer.target)?.node ?? null)));
  const record = container === null ? null : recordOf(container);
  if (composer === null || container === null || record === null) {
    return (
      <section className="view layout-panel" data-region="layout-composer-panel" aria-label={t('panel.layoutComposer')}>
        <div className="view__title">{t('panel.layoutComposer')}</div>
        <p className="layout-panel__text">{t('layout.panel.idle')}</p>
      </section>
    );
  }
  const prediction = predict(record.intent, null);
  const names = composer.selection.map((id) => findRegion(record.intent, id)?.name ?? id);
  return (
    <section className="view layout-panel" data-region="layout-composer-panel" aria-label={t('panel.layoutComposer')}>
      <div className="view__title">{t('layout.panel.container', { name: container.name })}</div>
      <p className="layout-panel__prediction" data-layout-prediction={prediction.key}>
        {t(prediction.key as MessageId, Object.fromEntries(Object.entries(prediction.params).map(([name, value]) => [name, name === 'sizing' && typeof value === 'string' && !value.endsWith('px') ? t(`layout.word.${value}` as MessageId) : value])))}
      </p>
      {TOOL === undefined ? null : (
        <div className="layout-panel__group">
          <span className="layout-panel__label">{t('layout.door.tool')}</span>
          <div className="segmented" role="group" aria-label={t('layout.door.tool')}>
            {STROKE_MODES.map((tool) => (
              <DoorControl key={tool} entry={TOOL} args={{ tool }} current={composer.tool === tool} label={t(`layout.tool.${tool}` as MessageId)}>
                <span className="door__label">{t(`layout.tool.${tool}` as MessageId)}</span>
              </DoorControl>
            ))}
          </div>
        </div>
      )}
      {LENS === undefined ? null : (
        <div className="layout-panel__group">
          <span className="layout-panel__label">{t('layout.door.lens')}</span>
          <div className="segmented" role="group" aria-label={t('layout.door.lens')}>
            {LENSES.map((lens) => (
              <DoorControl key={lens} entry={LENS} args={{ lens }} current={composer.lens === lens} label={t(`layout.lens.${lens}` as MessageId)}>
                <span className="door__label">{t(`layout.lens.${lens}` as MessageId)}</span>
              </DoorControl>
            ))}
          </div>
        </div>
      )}
      <p className="layout-panel__text" data-layout-selection={composer.selection.join(' ')}>
        {names.length === 0 ? t('layout.panel.noSelection') : t('layout.panel.selection', { names: names.join(', ') })}
      </p>
      <p className="layout-panel__text">{t('layout.panel.help')}</p>
      <div className="layout-panel__actions">
        {DELETE === undefined ? null : <DoorControl entry={DELETE} />}
        {DONE === undefined ? null : <DoorControl entry={DONE} />}
      </div>
    </section>
  );
}
