// The breakpoint tabs (spec breakpoints-switch, project-breakpoints) of the frame's bar and of the preview bar: one tab
// per breakpoint of the project's table, in its order (widest first). A default breakpoint's tab is its own door
// (properties.json's four); a breakpoint the project made is drawn by the region's project door, with the breakpoint
// as its argument; a default the project removed has no tab. All of them are drawn where the first tab door stands.
import type { ReactNode } from 'react';
import { breakpointName, breakpointsOf, type ProjectBreakpoint } from '../../core/document/breakpoints.ts';
import type { RegionId } from '../../generated/ids.ts';
import type { DoorEntry } from '../../manifest/runtime.ts';
import { DoorControl } from '../doors/door.tsx';
import { doorSlots } from '../doors/placement.ts';
import { useEditorState } from '../store.ts';
import { useT } from '../text.ts';
import type { Slot } from '../doors/placement.ts';

interface TabDoors {
  // a default breakpoint's own door, by its id
  readonly own: ReadonlyMap<string, DoorEntry>;
  // the door a breakpoint the project made is shown with
  readonly project: DoorEntry | undefined;
  // the door where the tabs are drawn: the first tab door of the region
  readonly first: DoorEntry | undefined;
}

// a tab: a door whose command takes a breakpoint and nothing else (view.setBreakpoint)
const isTab = (entry: DoorEntry): boolean => {
  const args = Object.values(entry.command.args);
  return args.length === 1 && args[0]?.type === 'breakpoint';
};

const byRegion = new Map<RegionId, TabDoors>();
function tabDoors(region: RegionId): TabDoors {
  const held = byRegion.get(region);
  if (held !== undefined) return held;
  const tabs = doorSlots(region).filter(isTab);
  const own = new Map(tabs.flatMap((d) => (typeof d.door.args.breakpoint === 'string' ? [[d.door.args.breakpoint, d] as const] : [])));
  const doors = { own, project: tabs.find((d) => d.door.args.breakpoint === undefined), first: tabs[0] };
  byRegion.set(region, doors);
  return doors;
}

// What a region's Slots draws for a slot of the breakpoint tabs: every tab at the first, nothing at the others;
// undefined for a slot that is no tab.
export function breakpointTabSlot(region: RegionId, slot: Slot, tab: (entry: DoorEntry, breakpoint: ProjectBreakpoint, args: Readonly<Record<string, unknown>>) => ReactNode): ReactNode | undefined {
  if (slot.kind !== 'door' || !isTab(slot.entry)) return undefined;
  const doors = tabDoors(region);
  if (slot.entry.ref !== doors.first?.ref) return null;
  return <BreakpointTabList key={slot.entry.ref} doors={doors} tab={tab} />;
}

function BreakpointTabList({ doors, tab }: { readonly doors: TabDoors; readonly tab: (entry: DoorEntry, breakpoint: ProjectBreakpoint, args: Readonly<Record<string, unknown>>) => ReactNode }) {
  const table = useEditorState((s) => breakpointsOf(s.document));
  return (
    <>
      {table.map((breakpoint) => {
        const own = doors.own.get(breakpoint.id);
        if (own !== undefined) return tab(own, breakpoint, {});
        return doors.project === undefined ? null : tab(doors.project, breakpoint, { breakpoint: breakpoint.id });
      })}
    </>
  );
}

// The preview bar's tab: the breakpoint's name, as the frame's tabs say it
export function PreviewBreakpointTab({ entry, breakpoint, args }: { readonly entry: DoorEntry; readonly breakpoint: ProjectBreakpoint; readonly args: Readonly<Record<string, unknown>> }) {
  const t = useT();
  return (
    <DoorControl key={`${entry.ref}:${breakpoint.id}`} entry={entry} args={args}>
      <span className="door__label">{breakpointName(breakpoint, t)}</span>
    </DoorControl>
  );
}
