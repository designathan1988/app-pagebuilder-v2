> Restored 2026-10-02 from `git show 2b93e68^:docs/PROGRESS.md` into the archive: `2b93e68` folded it into `docs/PROJECT.md` (since superseded by [`docs/PRODUCT.md`](../PRODUCT.md)) and deleted it, but code comments still cite it by name (2 citations; AUD-30), so it is kept here for them to resolve. History only; where it and the code disagree, the code, the manifest and `spec/BEHAVIOUR.md` hold.

# Progress

At most 60 lines: state, the user's pending decisions, open findings. History and proofs: `docs/history.md`.

## State (2026-09-29: builder-6, the consolidated tree)

- THIS root is `builder-6`, the consolidated tree; the Pager's read-only reference material sits in the old
  checkout (`../builder-5/reference/`), which otherwise holds only its git history. One tree, one copy of the
  application. Every line that held finished work is merged here: the
  workspace line (the panels that leave their place, the shortcuts panel, the clipboard's cut and styles, the
  status bar, command-bar-set-property), the layout-tools line (the canvas grid editor 8.2, the layout actions
  8.1, the component names A3.12, the positioned moves A3.13, the responsive grid A1.4). The old parallel lines
  are deleted; `origin/codex` (two days old, the abandoned parallel attempt, its Settings items since built here)
  is not merged.
- The shell stylesheet is split by region (window, doors, menus, top bar, sidebar, canvas, inspector, panels,
  dock, status bar, the panel editors, canvas editing, the window overlays), imported in the original order from
  main.tsx; the rules and their cascade order are proven identical to the single file it came from.
- **Every command of the manifest is built** (`src/app/commands.ts` holds no NOT_AVAILABLE_YET). Two features are
  still unregistered as built: `hover-measure` and `shortcuts-e2e-sweep`.
- The static checks are green on this tree: `gen:check`, `manifest:check` (1333 scenarios), `typecheck` (both
  projects), `lint`, `unit` (663 tests).
- The bureaucracy is gone: no worktrees, no agent branches, no hooks or guards, no impact machinery, no
  measurement harness, no checkpoints. `tools/` holds what the app is built and tested with: `gen`, `lint`,
  `manifest`, `runner`.

## The architecture pass (2026-09-29; the plan the user approved)

- **A** — T3: an awaited door re-checks what it computed before it dispatches, and `store.notice` says when it cannot
  (the first shape compared a document revision and refused benign changes; the block's specs proved it wrong and it
  was corrected). T2: a commit the validator refuses is an incident, not a refusal — the previous state stays, the
  feed records it, development and tests throw. T1+T6: the tree kernel (`src/core/document/tree.ts`: insert, remove,
  release the references to what leaves, the value-level release for a node a command writes back, the single
  into-itself test) with the two commands that dropped references it now releases, and `orphanReferences` asking the
  document (is that some node's `id` attribute?) instead of a value's shape.
- **B** — T4: `src/core/document/migrations.ts`; the project reader carries an older file forward step by step,
  refuses a newer version naming it, and refuses a hole in the chain.
- **C** — T5: `src/core/explain.ts` and the test port's `explain`: why a command would not run now, why these nodes
  cannot go into that parent, what the document says about a node.
- **Deferred, with the reason:** T7 (the pointer's module-level singletons) removes a *latent* problem only — two
  editors sharing one page — and no flow today creates one (the preview renders the export; each browser check opens
  one editor). It would rewrite the hottest file (pointer.ts, 2,500 lines) for a case that does not occur; it is kept
  in the plan for the first feature that offers two editors side by side.
- **Three defects the block's browser tests found, fixed:** Shift+click ran a plain select (a drag key swallowed the
  click's own), `unwrap` and the code pane's HTML apply dropped references (a thrown invalid state instead of a
  refusal), and three specs carried numbers the merged base styles had moved (their points and values now come from
  the page itself).

## What is left (the user's goal in force: the whole application working end to end)

1. The properties panel (5.1): its data first (property icons — 2 of 181 today; sliders — one property; the
   presets of A3.30), then one home for the field components, then the visual pass (`.visual-qa` holds the
   observations, the panel's own CSS moves to a file of its own).
2. The remaining audit items, in the brief's order: 7.1 (A3.3, A3.5, A3.25), 7.6/7.7 (A3.26, A3.27), 8.1
   (A3.20), 8.3, 9.1 (A3.40, A3.45), then 14/15/16/17/20 of the manifest's feature groups.
3. `hover-measure` and `shortcuts-e2e-sweep` (the two features not built).
4. The final pass: the complete `npm run e2e` once, on a quiet machine (the census's own walk is the long part),
   then the browser sweep of the whole application at 100% and at Fit, Desktop and Phone.

## Decisions taken in the consolidation (2026-09-29)

- Conflicting lines are resolved as unions, never by dropping a side: pointer.ts carries the timeline's and the
  panels' drags, the dock draws Checks and Shortcuts, clipboard.ts keeps the external paste beside cut and the
  styles, the catalogues take every key (2042 each, equal sets).
- `manifest/references.json` is a ledger: merged by (kind,id), 17 entries recovered from the layout-tools line.
- The unit suite follows the built behaviour, with the assertions kept as strong: the store's marker entry now
  stands in the test table (every real command is built), a section carrying the essentials is drawn open,
  hasBox covers every element outside SVG, a wrap of non-adjacent siblings asks first.
- `docs/testing/README.md` and `CLAUDE.md` describe the new cycle: basic test per feature with browser photos,
  the block's tests at the end of the block, the complete suite once at the end.

## Open findings

- **The selection label rests on the text above it** (`npm run ui -- insert` photographs it after the last
  step): with a Paragraph selected under a Heading, the label is placed above the Paragraph and overlaps the
  Heading's text, though the label rule (DESIGN.md "Label rule") says it never covers page text. Found by the UI
  driver's photo; to fix in the UI pass, with the driver as the proof.

- The complete suite has not run since the consolidation; run it once before the next block's work is called
  done (the user's rule: the whole suite only when the application is ready).
- The `.memory/` brief still carries orders of the fragmented period (worktrees, agents, the parallel Codex
  line). `builder-brief.md` now holds the goal in force and the standing orders only.
