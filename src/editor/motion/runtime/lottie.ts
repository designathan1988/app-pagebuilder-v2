// Lottie in the motion runtime (plan stage 10: "Lottie só quando usado"; spec motion-runtime, Lottie): an action
// plays, pauses, stops, seeks or plays a segment of a Lottie animation inside its target. The player is lottie-web
// (MIT, vendored at src/editor/motion/vendor/), which the page loads only when a timeline it plays uses Lottie
// (export: js/lottie.min.js before js/motion.js); the animation data comes with the motion data (core/motion/export.ts),
// so nothing is fetched and the page plays from file:// too. One player per target and file, made at the first action
// that needs it, destroyed with the runtime.
//
// Self-contained: embedded as text in the page's motion script (self-contained.test.ts).
import type { Effect } from '../../../core/motion/model.ts';
import type { MotionKit } from './kit.ts';

// the part of lottie-web's API the runtime uses (lottie-web 5.x: loadAnimation and its AnimationItem)
interface LottiePlayer {
  play(): void;
  pause(): void;
  stop(): void;
  setSpeed(speed: number): void;
  setLoop(loop: boolean): void;
  goToAndStop(value: number, isFrame: boolean): void;
  playSegments(segment: readonly [number, number], forceFlag: boolean): void;
  destroy(): void;
}
interface LottieLibrary {
  loadAnimation(options: { container: Element; renderer: 'svg'; loop: boolean; autoplay: boolean; animationData: unknown }): LottiePlayer;
}

export interface LottieKit {
  control(effect: Extract<Effect, { kind: 'lottie' }>, target: Element): void;
  dispose(): void;
}

export function createLottie(win: Window, kit: MotionKit): LottieKit {
  const players = new Map<Element, Map<string, LottiePlayer>>();
  let missingSaid = false;

  function playerOf(effect: Extract<Effect, { kind: 'lottie' }>, target: Element): LottiePlayer | null {
    const held = players.get(target)?.get(effect.file);
    if (held !== undefined) return held;
    const library = (win as Window & { lottie?: LottieLibrary }).lottie;
    if (library === undefined || typeof library.loadAnimation !== 'function') {
      if (!missingSaid) kit.report({ code: 'lottie-missing', detail: effect.file });
      missingSaid = true;
      return null;
    }
    const data = kit.config.lottie[effect.file];
    if (data === undefined) {
      kit.report({ code: 'lottie-data', detail: effect.file });
      return null;
    }
    // lottie-web writes into the data it is given: each player takes its own copy
    const player = library.loadAnimation({ container: target, renderer: 'svg', loop: effect.loop, autoplay: false, animationData: JSON.parse(JSON.stringify(data)) as unknown });
    const byFile = players.get(target) ?? new Map<string, LottiePlayer>();
    byFile.set(effect.file, player);
    players.set(target, byFile);
    return player;
  }

  function control(effect: Extract<Effect, { kind: 'lottie' }>, target: Element): void {
    if (effect.file === '') return;
    const player = playerOf(effect, target);
    if (player === null) return;
    player.setLoop(effect.loop);
    player.setSpeed(effect.speed);
    // less motion asked: the animation shows its last frame of the segment, or its first, without playing
    if (kit.reducedMotion() && (effect.operation === 'play' || effect.operation === 'segment')) {
      player.goToAndStop(effect.operation === 'segment' ? (effect.to ?? 0) : 0, true);
      return;
    }
    if (effect.operation === 'play') player.play();
    else if (effect.operation === 'pause') player.pause();
    else if (effect.operation === 'stop') player.stop();
    else if (effect.operation === 'seek') player.goToAndStop(effect.from ?? 0, true);
    else player.playSegments([effect.from ?? 0, effect.to ?? 0], true);
  }

  function dispose(): void {
    for (const byFile of players.values()) for (const player of byFile.values()) player.destroy();
    players.clear();
  }

  return { control, dispose };
}
