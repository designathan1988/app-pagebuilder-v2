// What the canvas draws while a container is composed (spec "Layout Lenses", "Preview", "Structural Handles"): over
// the container, the stage that takes the composer's presses (interaction/tool.ts), the regions of the intent in the
// lens chosen with their labels, the handles of the selection — each the canvas-handle door of its kind — and the
// stroke held now with what its release would do. Measured from the page on every animation frame, like the rest of
// the canvas chrome; drawn in the chrome, never in the page.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { locate, type NodeId } from '../../../core/document/model.ts';
import type { MessageId } from '../../../generated/ids.ts';
import { manifest, type DoorEntry } from '../../../manifest/runtime.ts';
import { canvasFrame, nodeBox } from '../../../editor/canvas/coordinates.ts';
import { useEditorState } from '../../../editor/store.ts';
import { useT } from '../../../editor/text.ts';
import type { HandleKind } from '../gestures/recognize.ts';
import { recordOf } from '../host/record.ts';
import { composerOf } from '../host/state.ts';
import { preview } from '../interaction/preview.ts';
import { scene, type Words } from './scene.ts';
import './composer.css';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// the doors a press on the stage or on a handle runs (manifest/commands/layout-composer.json)
const STAGE: DoorEntry | undefined = manifest.doors.find((d) => d.door.kind === 'canvas-drag' && d.door.gesture === 'layout-stroke');
const HANDLE_DOORS: Readonly<Partial<Record<HandleKind, DoorEntry>>> = Object.fromEntries(
  manifest.doors.flatMap((d) => (d.door.kind === 'canvas-handle' && d.door.gesture === 'layout-handle' ? [[d.door.handle.replace(/^layout-/, ''), d]] : [])),
);
const REGION_CLICK: DoorEntry | undefined = manifest.doors.find((d) => d.door.kind === 'canvas-click' && d.door.gesture === 'layout-click' && d.door.modifier === null);

// the words of a label: an enumerated value (a sizing, a semantic, a flow) in the person's language
const WORDS = new Set(['sizing', 'semantic', 'flow']);
function useWords(): (words: Words) => string {
  const t = useT();
  return (words) => t(words.key as MessageId, Object.fromEntries(Object.entries(words.params).map(([name, value]) => [name, WORDS.has(name) && typeof value === 'string' && !value.endsWith('px') ? t(`layout.word.${value}` as MessageId) : value])));
}

export function LayoutOverlay() {
  const composer = useEditorState((s) => composerOf(s.ui));
  const container = useEditorState((s) => (composer === null ? null : (locate(s.document, composer.target)?.node ?? null)));
  const record = container === null ? null : recordOf(container);
  const layer = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const held = useSyncExternalStore(preview.subscribe, preview.get);
  const say = useWords();
  const t = useT();
  useEffect(() => {
    if (composer === null) return;
    let request = 0;
    const measure = () => {
      const frame = canvasFrame();
      const origin = layer.current?.parentElement?.getBoundingClientRect();
      const found = frame === null || origin === undefined ? null : nodeBox(frame, composer.target as NodeId);
      const next = found === null || origin === undefined ? null : { x: found.x - origin.x, y: found.y - origin.y, width: found.width, height: found.height };
      setBox((before) => (before !== null && next !== null && before.x === next.x && before.y === next.y && before.width === next.width && before.height === next.height ? before : next));
      request = requestAnimationFrame(measure);
    };
    request = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(request);
  }, [composer]);
  // entering the composer puts the keyboard on its stage: its keys (Escape leaves, Delete deletes the selected regions)
  // work at once, whatever control opened it
  const stage = useRef<HTMLDivElement>(null);
  const placed = box !== null;
  const composing = composer?.target ?? null;
  useEffect(() => {
    if (composing !== null && placed) stage.current?.focus({ preventScroll: true });
  }, [composing, placed]);
  const drawn = useMemo(() => (record === null || composer === null ? null : scene(held?.reading?.result?.ok === true ? held.reading.result.graph : record.intent, composer.selection, composer.lens)), [record, composer, held]);
  if (composer === null || record === null || box === null || drawn === null || STAGE === undefined) return <div ref={layer} className="layout-composer" hidden />;
  const scale = box.width / drawn.viewport.width;
  const at = (b: Box): CSSProperties => ({ left: b.x * scale, top: b.y * scale, width: b.width * scale, height: b.height * scale });
  const reading = held?.reading ?? null;
  const refused = reading !== null && (reading.problems.length > 0 || reading.result?.ok === false);
  const problem = reading === null ? null : (reading.problems[0] ?? (reading.result?.ok === false ? reading.result.problems[0] : undefined) ?? null);
  return (
    <div ref={layer} className="layout-composer" data-region="layout-composer-canvas">
      <div
        className={`layout-composer__stage${refused ? ' is-refused' : ''}`}
        ref={stage}
        tabIndex={-1}
        data-key-context="layout-composer"
        aria-label={t('layout.door.stage')}
        data-layout-stage=""
        data-door={STAGE.ref}
        data-viewport-width={drawn.viewport.width}
        data-viewport-height={drawn.viewport.height}
        data-cursor={reading?.cursor ?? 'crosshair'}
        style={{ left: box.x, top: box.y, width: box.width, height: drawn.viewport.height * scale }}
      >
        {drawn.regions.map((region) => (
          <div
            key={region.id}
            className={['layout-composer__region', region.selected ? 'is-selected' : '', region.content ? 'is-content' : '', region.hidden ? 'is-hidden' : '', reading?.visited.includes(region.id) === true ? 'is-visited' : ''].filter((c) => c !== '').join(' ')}
            data-layout-region={region.id}
            data-door={REGION_CLICK?.ref}
            data-depth={region.depth}
            style={{ ...at(region.box), borderRadius: region.radius * scale, ...(region.polygon === null ? {} : { clipPath: `polygon(${region.polygon.map((p) => `${(p.x - region.box.x) * scale}px ${(p.y - region.box.y) * scale}px`).join(', ')})` }) }}
          >
            <span className="layout-composer__label">{say(region.label)}</span>
          </div>
        ))}
        {reading?.area == null ? null : <div className="layout-composer__area" data-layout-preview="area" style={at(reading.area)}><span className="layout-composer__measure">{t('layout.preview.size', { width: Math.round(reading.area.width), height: Math.round(reading.area.height) })}</span></div>}
        {held === null || held.points.length < 2 ? null : (
          <svg className="layout-composer__stroke" width={box.width} height={box.height} aria-hidden="true">
            <polyline points={held.points.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')} />
            {reading?.cuts.map((piece, i) => <line key={i} className="layout-composer__cut" x1={piece.from.x * scale} y1={piece.from.y * scale} x2={piece.to.x * scale} y2={piece.to.y * scale} />)}
          </svg>
        )}
        {drawn.relations.map((relation, i) => (
          <svg key={`r${String(i)}`} className="layout-composer__relation" width={box.width} height={box.height} aria-hidden="true">
            <line x1={relation.from.x * scale} y1={relation.from.y * scale} x2={relation.to.x * scale} y2={relation.to.y * scale} />
          </svg>
        ))}
        {held !== null
          ? null
          : drawn.handles.map((handle) => {
              const door = HANDLE_DOORS[handle.kind];
              if (door === undefined) return null;
              return (
                <span
                  key={handle.id}
                  className={`layout-composer__handle layout-composer__handle--${handle.kind}${handle.axis === null ? '' : ` is-${handle.axis}`}`}
                  data-layout-handle={handle.id}
                  data-door={door.ref}
                  title={t(door.door.labelKey as MessageId)}
                  style={{ left: handle.point.x * scale, top: handle.point.y * scale }}
                />
              );
            })}
      </div>
      {problem === null || problem === undefined ? null : (
        <div className="layout-composer__problem" style={{ left: box.x, top: box.y + drawn.viewport.height * scale }}>
          {t(`layout.problem.${problem.code}` as MessageId, problem.params)}
        </div>
      )}
    </div>
  );
}
