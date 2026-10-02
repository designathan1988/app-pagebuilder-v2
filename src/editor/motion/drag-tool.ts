// The motion Timeline's drags as a pointer tool (editor/input/pointer-tools.ts; spec motion-timeline): a primary press
// on a bar, a bar's start or end, a keyframe, a marker or the playhead — the controls drawn for the panel-drag doors of
// manifest/commands/motion.json — is the Timeline's. Every move runs the door's command with the arguments the
// pointer's travel makes (pointer.ts motionDragArgs: snapping, the selected bars or keyframes moving together), anew
// from the press, so the panel and the canvas follow the pointer and Escape puts everything back; a press on the ruler
// with no travel puts the playhead under it.
import type { DoorId } from '../../generated/ids.ts';
import { manifest, numberConstant } from '../../manifest/runtime.ts';
import type { PointerTool, ToolDispatch, ToolPoint } from '../input/pointer-tools.ts';
import { isMotionDragSource, motionDragArgs, motionPress } from './pointer.ts';

// how far a press travels before it is a drag, in screen px (interactions.json drag.threshold)
const DRAG_THRESHOLD = numberConstant('drag.threshold');

// The click of the control a drag handle lies in (a bar's or a keyframe's selection): its door, or the door of the
// same control the key held names (manifest: the panel-control doors of that control and their modifiers).
function clickAround(handle: Element, at: ToolPoint): ToolDispatch | null {
  const around = handle.parentElement?.closest('[data-door]') ?? null;
  const plain = around === null ? undefined : manifest.doorByRef.get((around.getAttribute('data-door') ?? '') as DoorId);
  if (around === null || plain === undefined || plain.door.kind !== 'panel-control') return null;
  const control = plain.door.control;
  const modifier = at.shift ? 'Shift' : null;
  const chosen = manifest.doors.find((d) => d.command.id === plain.command.id && d.door.kind === 'panel-control' && d.door.control === control && (d.door.modifier ?? null) === modifier) ?? plain;
  const parsed: unknown = JSON.parse(around.getAttribute('data-args') ?? '{}');
  const args = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  return { command: chosen.command.id, args: { ...args, ...chosen.door.args } };
}

export const motionDragTool: PointerTool = {
  id: 'motion-timeline',
  press(at, target, state) {
    const control = target.closest('[data-door]');
    const entry = control === null ? undefined : manifest.doorByRef.get((control.getAttribute('data-door') ?? '') as DoorId);
    if (control === null || entry === undefined || entry.door.kind !== 'panel-drag' || !isMotionDragSource(entry.door.source)) return null;
    const parsed: unknown = JSON.parse(control.getAttribute('data-args') ?? '{}');
    const args = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    // the track the times are measured along: the one the control lies on, else the panel's (the playhead's ruler)
    const track = control.closest('[data-motion-track]') ?? control.closest('.motion-timeline')?.querySelector('[data-motion-track]') ?? null;
    if (track === null) return null;
    const press = motionPress(entry.door.source, args, track.getBoundingClientRect().left, at.x);
    const command = entry.command.id;
    const run = (point: ToolPoint): ToolDispatch | null => {
      const made = motionDragArgs(press, state, point.x, point.alt);
      return made === null ? null : { command, args: { ...entry.door.args, ...made } };
    };
    let moved = false;
    return {
      move(point) {
        // a press that travels less than the drag threshold is still a click
        if (!moved && Math.abs(point.x - at.x) < DRAG_THRESHOLD) return null;
        moved = true;
        return run(point);
      },
      release(point, gesture) {
        if (moved) return;
        // a press with no travel: the playhead goes under it; a bar or a keyframe is clicked, which selects it (with
        // Shift, adds it to the selection) through the door of the control around it
        const step = entry.door.kind === 'panel-drag' && entry.door.source === 'motion-playhead' ? run(point) : clickAround(control, point);
        if (step !== null) gesture.dispatch(step.command as never, step.args as never);
      },
      cancel() {
        moved = false;
      },
    };
  },
};
