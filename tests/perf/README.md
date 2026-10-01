# Large-page performance reference

Run `npm run perf` with no other browser suite, unit check or build running. It builds the application, uses installed
Chrome at 1440×900 with one worker and no tracing, and measures three fresh profiles against the unchanged 641-node
Journey 03 fixture. `--runs N` changes the number of complete runs. Each run verifies all rendered nodes, ten real
selection clicks, native canvas typing, a confirmed style change, and undo by both buttons and shortcuts, each restoring the exact original document.

Every event sample and page photograph is retained under `.cache/logs/perf-<timestamp>/`. The report includes input,
opening and per-action timings, the commit, environment, historical reference, raw samples and a screenshot. An
incomplete run or invalid sample fails; no partial or missing sample is reported as zero.

The primary measure is the trusted event timestamp to the second animation frame, using that event window's clock.
This is a rendering proxy, **not physical display presentation time**. Parent-realm listeners observe the script-disabled
canvas. Mixing independently rounded epoch origins produced negative sub-millisecond delays and was rejected.
Modifier-only keydowns remain in the raw data and study-method summary, but are excluded from primary interactions.
Opening includes driver handoff, file reading and readiness assertions. Native Event Timing is supplementary (16ms
threshold, 8ms granularity, main document); censored samples are not used for primary percentiles.

Percentiles retain the study's sorted `floor(p × n)` index convention. Raw samples are pooled, never averages of run
percentiles. The old 90.1/286.6ms figures are historical handler-based measurements in a different environment and on a
different task path. They are not evidence of a speed improvement in this build.

The plan's 35ms typical / 100ms tail targets are deliberately checked **per action group**, a more conservative guard
than checking only the aggregate. Recording mode preserves an over-budget report; it does not label that budget passed.
`npm run perf -- --enforce` exits unsuccessfully when any measured group misses the target. Optimisation remains the
product work of stage 3. `npm run perf -- --render <output-directory>` redraws an existing report without rerunning the
benchmark, preserving its measurement timestamp, commit and environment; add `--enforce` to audit that stored result.

Sources: [Event Timing](https://www.w3.org/TR/event-timing/), [MDN timing limits](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming),
[Playwright workers](https://playwright.dev/docs/test-parallel), [HTML script realms](https://html.spec.whatwg.org/multipage/webappapis.html#prepare-to-run-script),
[DOM event timestamps](https://dom.spec.whatwg.org/#interface-event).
