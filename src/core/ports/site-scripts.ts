import type { RuntimeConfig } from '../motion/export.ts';

/** Browser runtimes are supplied by the composition layer; the document core never imports the DOM. */
export interface SiteScripts {
  forms(): string;
  // the motion script of the site (js/motion.js): the runtime and the site's motion data (spec export-motion-js)
  motion?(config: RuntimeConfig): string;
  // the Lottie player (js/lottie.min.js), written only when a timeline plays a Lottie animation
  lottie?(): string;
}
