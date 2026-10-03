Archived 2026-10-02 from `.memory/module-ownership.md` (not versioned): the ownership of the module candidates of review item R5, 2026-10-01 (`docs/PRODUCT.md` DEC-32). History only.

# Module candidate ownership — R5

The active integration candidates are `.cache/scratch/modules/layout/` for Layout Composer and
`.cache/scratch/modules/motion/` for motion/interactions/timeline. A candidate is not a delivered application feature.
Never integrate competing files from the retired `layout-composer/` or `animation/` packages alongside these.

The older candidates are retained under `.cache/scratch/retired-module-candidates/r5/`, for read-only comparison.
Their original bytes and tests are preserved. Relative imports in retired material are historical, not executable
integration instructions. Their former names must not be used to select a package for integration.

## Layout decision

The current package covers more of the full specification: graph, reversible operations, topology, constraints,
compilation, responsive variants and injected presentation. The older package is a smaller rectangular kernel.
Useful old cases are brought into the current owner's tests: pinwheel grid, unequal flex gaps, duplicate constraint
identifiers. No second geometry, layout compiler or command owner is introduced. Shared coordinates, snapping,
tree transactions and style writing remain with the existing application owners.

## Motion decision

The current package provides the richer motion model, target/action runtime, trigger disposal, native playback,
timeline helpers and presentation. The older package contains sequence and legacy timeline helpers only.
Unique checks/helpers are ported into the current package with tests; its incompatible ActionSequence/Target model
is not imported as another runtime. Existing `core/events`, `core/animation` and `editor/timeline` retain command
ownership. Integrating the current candidate must extend these owners, not register competing owners.

## Integration boundary

Only the main agent copies reviewed complete pieces into source and edits manifest/spec/wiring. Active agents write
only their assigned candidate folders. No candidate has been copied into `src/` at this decision. Main must verify
the final owner map and tests at integration; neither scratch package's isolated tests prove the finished app.
