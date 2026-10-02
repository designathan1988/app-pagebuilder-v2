// The parts of the motion runtime and how they reach each other (spec motion-runtime). Each part is made by a
// self-contained factory that takes the window it runs in and this kit, filled in once every part is made, so a part
// asks another only while it runs (the actions ask the player to control a timeline, the player asks the actions to
// run an instant one). Types only: the factories are composed by compose.ts for the editor and by script.ts, as text,
// for a page.
import type { EasingKit } from '../../../core/motion/easing.ts';
import type { RuntimeConfig } from '../../../core/motion/export.ts';
import type { ActionKit } from './actions.ts';
import type { BehaviourKit } from './behaviours.ts';
import type { LottieKit } from './lottie.ts';
import type { PlayerKit } from './player.ts';
import type { ScrollKit } from './scroll.ts';
import type { SplitKit } from './split-text.ts';
import type { TargetKit } from './targets.ts';
import type { TriggerKit } from './triggers.ts';

// A problem the runtime meets (a Lottie player missing, a media element that refuses to play, a clipboard refused):
// a code the editor names in the person's language (motion.runtime.<code>) and what it concerns. The page's own runtime
// writes it to the console; the editor's run mode shows it in the status bar and the incident feed.
export interface RuntimeProblem {
  readonly code: 'lottie-missing' | 'lottie-data' | 'media-refused' | 'clipboard-refused' | 'action-failed' | 'timeline-missing';
  readonly detail: string;
}

export interface MotionKit {
  readonly win: Window;
  readonly config: RuntimeConfig;
  // where the runtime runs: an exported page or the preview ("page"), or the editor's canvas ("canvas"), where a
  // navigation or a form submission would leave the editor
  readonly mode: 'page' | 'canvas';
  report(problem: RuntimeProblem): void;
  // whether the person asked for less motion (prefers-reduced-motion: reduce)
  reducedMotion(): boolean;
  // the breakpoint the page is laid out at now: the narrowest whose width holds the viewport, else the base
  activeBreakpoint(): string;
  easing: EasingKit;
  targets: TargetKit;
  split: SplitKit;
  actions: ActionKit;
  lottie: LottieKit;
  scroll: ScrollKit;
  player: PlayerKit;
  triggers: TriggerKit;
  behaviours: BehaviourKit;
}
