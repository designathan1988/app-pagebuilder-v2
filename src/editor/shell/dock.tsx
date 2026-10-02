// The bottom dock (DESIGN.md "Dock and status bar"): its strip with a tab for each open dock panel (the tab-strip
// component, the panel's icon from layout.json panels), show or hide, maximize, close the tab; its body when open.
import { useMemo } from 'react';
import { checksOf, type CheckIssue } from '../../core/a11y/checks.ts';
import { manifest } from '../../manifest/runtime.ts';
import type { FeatureId, MessageId } from '../../generated/ids.ts';
import { isFeatureBuilt } from '../../app/features.ts';
import { locate } from '../../core/document/model.ts';
import { TimelinePanel } from '../timeline/panel.tsx';
import { MotionTimelinePanel } from '../motion/ui/timeline.tsx';
import { DoorControl, Icon } from '../doors/door.tsx';
import { doorSlots } from '../doors/placement.ts';
import { useEditorState } from '../store.ts';
import { useT } from '../text.ts';
import { PANELS, panelName, type Panel } from '../workspace/panels.ts';
import type { BodyTable } from './bodies.ts';
import { Slots } from './slots.tsx';
import { Shortcuts } from './shortcuts.tsx';

const TAB = doorSlots('tab-strip')[0];
// the strip's button that closes the tab it shows (its door's own arguments close a panel)
const CLOSE = doorSlots('dock-strip').find((d) => d.door.args.open === 'close');
// the Checks panel's row: the door that selects the node an issue is about (the region's own entry, spec
// accessibility-checks)
const ISSUE = doorSlots('dock-checks').find((d) => d.door.kind === 'panel-control' && d.door.control === 'issue');

// The Timeline tab: the animations of the selected element, the settings of the one it shows, and the track with its
// ruler, playhead and keyframes (group 18; src/editor/timeline/panel.tsx draws it, every control a door placed in the
// region).
function Timeline() {
  return <TimelinePanel />;
}

// The Document tab of Developer tools (spec workbench-panel, Problems in Pager 2): the document as it is now, as JSON,
// read-only, drawn again after every command that changes it.
// A string longer than this (a file's bytes, base64) is shown as its start and its length: one image made a line of a
// million characters, five million pixels wide (the audit's U-027)
const LONGEST_SHOWN = 200;
function DocumentJson() {
  const t = useT();
  const document = useEditorState((s) => s.document);
  const text = useMemo(
    () => JSON.stringify(document, (_key, value: unknown) => (typeof value === 'string' && value.length > LONGEST_SHOWN ? t('dock.document.long', { start: value.slice(0, 48), count: value.length }) : value), 2),
    [document, t],
  );
  return (
    <pre className="dock-document" tabIndex={0} aria-readonly="true" aria-label={t(panelName('document'))}>
      {text}
    </pre>
  );
}

// The Checks panel (spec accessibility-checks): one row per element with issues (core/a11y/checks.ts, the one owner of
// the list), its issues inside it in the list's order, each row the region's own door (selection.select) with the node
// it is about, so pressing a row selects that element on the canvas and in the Layers (Problems 3: an image with no alt
// and no source is one row, never two doors for one element). The list is read from the store, so it follows every command;
// it never blocks editing or the export — a page with issues is a page like any other.
// whether each category of the checks arrives with a built feature (checks.json)
const CATEGORY_BUILT = new Map(manifest.checks.categories.map((one) => [one.id, isFeatureBuilt(one.feature as FeatureId)] as const));
// the issues of each element together, in the order the list first names the element
function byNode(issues: readonly CheckIssue[]): CheckIssue[][] {
  const held = new Map<string, CheckIssue[]>();
  for (const issue of issues) held.set(issue.node, [...(held.get(issue.node) ?? []), issue]);
  return [...held.values()];
}
function Checks() {
  const t = useT();
  const document = useEditorState((s) => s.document);
  // an issue of a category whose feature is not built yet is not listed (checks.json: each category's feature)
  const issues = useMemo(() => checksOf(document, manifest.interactions.checks).filter((issue) => CATEGORY_BUILT.get(issue.category) !== false), [document]);
  // the issue's own words: the rule, the category the manifest names and the element it is about
  const words = (issue: { rule: MessageId; category: string; node: string }) => {
    const category = manifest.checks.categories.find((one) => one.id === issue.category);
    return { category: t((category?.labelKey ?? 'checks.title') as MessageId), name: locate(document, issue.node)?.node.name ?? '' };
  };
  return (
    <div className="dock-region" data-region="dock-checks">
      {issues.length === 0 || ISSUE === undefined ? (
        <p className="dock-checks__none">{t('checks.none')}</p>
      ) : (
        <ul className="dock-checks__list">
          {byNode(issues).map((held) => (
            <li key={held[0]?.node}>
              <DoorControl entry={ISSUE} args={{ target: held[0]?.node }} className="dock-checks__row">
                <Icon name={PANELS.checks.icon} size="sm" />
                <span className="dock-checks__issues">
                  {held.map((issue) => (
                    <span key={issue.rule} className="dock-checks__issue">
                      <span className="dock-checks__rule">{t(issue.rule, words(issue))}</span>
                      <span className="dock-checks__fix">{t('checks.fix', { fix: t(issue.fix) })}</span>
                    </span>
                  ))}
                </span>
              </DoorControl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The body of each dock tab the editor draws; a tab without one says "not available yet" and the doors that only open
// it are not available yet (bodies.ts).
// the Motion tab: the project's motion timelines (spec motion-timeline; src/editor/motion/ui/timeline.tsx)
export const DOCK_TABS: BodyTable = { timeline: Timeline, motion: MotionTimelinePanel, document: DocumentJson, checks: Checks, shortcuts: Shortcuts };

// the tab's panel, named after its tab
function DockBody({ tab }: { readonly tab: Panel }) {
  const t = useT();
  const Body = DOCK_TABS[tab];
  return (
    <div className={`dock-body${Body ? '' : ' dock-body--empty'}`} role="tabpanel" aria-label={t(panelName(tab))}>
      {Body ? <Body /> : t('common.notAvailableYet')}
    </div>
  );
}

export function Dock() {
  const t = useT();
  const tabs = useEditorState((s) => s.ui.panels.dockTabs);
  const active = useEditorState((s) => s.ui.layout.activeDockTab);
  const state = useEditorState((s) => s.ui.layout.dock);
  // collapsed, the dock is no strip: the status bar draws its panels as icons (the audit's A3.18)
  if (state === 'collapsed') return null;
  return (
    <section className={`dock dock--${state}`} aria-label={t(panelName('workbench'))}>
      <div className="dock-strip" data-region="dock-strip">
        <div className="dock-strip__tabs" role="tablist" data-region="tab-strip" data-key-context="tab-strip">
          {TAB
            ? tabs.map((tab) => (
                <DoorControl key={tab} entry={TAB} args={{ group: 'workbench', panel: tab }}>
                  <Icon name={PANELS[tab].icon} size="sm" />
                  <span className="door__label">{t(panelName(tab))}</span>
                </DoorControl>
              ))
            : null}
        </div>
        <span className="dock-strip__actions">
          <Slots
            region="dock-strip"
            render={(slot) => {
              if (slot.kind !== 'door' || slot.entry !== CLOSE) return undefined;
              return active !== null ? <DoorControl key={slot.entry.ref} entry={slot.entry} args={{ panel: active }} /> : null;
            }}
          />
        </span>
      </div>
      {active !== null ? <DockBody tab={active} /> : null}
    </section>
  );
}
