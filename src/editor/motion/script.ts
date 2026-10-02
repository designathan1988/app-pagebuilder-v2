// The motion part of the site-scripts port (core/ports/site-scripts.ts; spec export-motion-js): the composition
// layer hands the core the page's motion script and, only when a timeline plays a Lottie animation, the Lottie player.
// The core decides what the page needs (core/motion/export.ts); this module only writes the browser code.
import type { RuntimeConfig } from '../../core/motion/export.ts';
import { motionRuntimeSource } from './runtime/compose.ts';
// lottie-web 5.13.0, its light build (the SVG renderer alone, no expression evaluation), MIT: vendor/LICENSE.lottie.md
import lottieSource from './vendor/lottie-light-5.13.0.min.js?raw';

export const motionScript = (config: RuntimeConfig): string => motionRuntimeSource(config);

// the player as the page loads it (export: js/lottie.min.js, before js/motion.js), its licence kept at its head
export const lottieScript = (): string => `/*! lottie-web 5.13.0 (light) | MIT License | Copyright (c) 2015 Bodymovin | https://github.com/airbnb/lottie-web */\n${lottieSource}\n`;
