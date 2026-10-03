> Archived 2026-10-02, superseded by [`docs/PRODUCT.md`](../PRODUCT.md) (DEC-36). Where each part went: the layers, the document and its rules, and the interface → PRODUCT.md 5.1–5.3; the development loop, the two runners, `e2e:affected`, the budgets and adding a feature → section 6; the state of the application (2026-10-01) → the requirements register (section 2) and the generated `docs/FEATURES.md`, its decisions → DEC-02, DEC-24, DEC-25, DEC-26; rules that are never broken → `CLAUDE.md` and PRODUCT.md sections 6–7; repeating the large-page measurement → section 6 (`npm run perf`). Kept whole as it stood at `93d4fb2`.

# Builder

A desktop pagebuilder that runs in recent Chrome only, for professionals who build websites. The edited page renders
inside an iframe scaled with CSS `zoom`; the document JSON is the source of truth, never the DOM.

This is the one project document. What the application is made of — every feature, command, door, scenario and
module, and which module owns which command — is not written here by hand: it is generated (`npm run inventory`) into
[docs/INVENTORY.md](INVENTORY.md), and `npm run inventory:check` fails while the two are out of step.

## The layers

| Layer | Where | Rule |
|---|---|---|
| The contract | `manifest/` | The single declaration: elements, properties, commands with their doors (entry points), interactions, layout, features with their scenarios. `npm run manifest:check` validates it; nothing is re-listed in code. |
| The document core | `src/core/` | Plain TypeScript, no React, no DOM (its ports are injected): the model, its validation, the structure, styles, the importer, the renderer, the export. |
| The editor | `src/editor/` | React, and only drawing and input: panels, canvas, drag, the keymap, the pointer owner. |
| The wiring | `src/app/` | The one command table and the one feature table; a missing or extra entry is a type error. |
| The manifest at runtime | `src/manifest/` | Loading, checking and looking up the contract. |
| Generated files | `src/generated/`, `src/ui/tokens.css`, `src/ui/icons.svg`, `manifest/generated/` | Written by `npm run gen` alone; `gen:check` fails on a hand edit. |
| Tools | `tools/` | `gen`, `manifest`, `lint`, `runner`, `inventory`, `ui` — what the app is built, checked and driven with. Node only. |

The owner of a concept is the module that registers its commands; the inventory names it. A second implementation of
a concept that has an owner is a defect.

## The document and its rules

- A project is one JSON document: `pages` (each a tree of nodes), `classes`, `components`, `tokens`, `swatches`,
  `files`, `animations`, `interactions`. A node holds `id`, `type` (from elements.json), `name`, `tag`, `attributes`,
  `classes`, `styles` (by breakpoint and state), `text` or `children`, and the flags `hidden` and `locked`.
- The tree is nested `children` only: a parent is computed by walking, never stored twice.
- **One applier.** Every change goes through `dispatch(command)`; a handler is pure and returns JSON patches, which
  `applyPatches` applies in `src/core/store/store.ts`. A gesture opens one transaction at the press and commits it at
  the release, so a drag is one undo step. State is deep-frozen in development, so an out-of-dispatch mutation throws.
- **The tree kernel** (`src/core/document/tree.ts`) owns the structure's own invariants: inserting, removing,
  releasing the references to what leaves (in both shapes — a patch for a node that stays, a value rewrite for a node
  a command writes back), and the single test for a move into its own subtree. Predictable invalid operations are
  refused **before** any patch exists.
- **A refused commit is a bug, not a refusal.** If a command's patches are valid but the whole document fails
  `validateDocument`, nothing of the change is published: the previous document, selection and history stay, the
  status bar says the command's change was refused and nothing changed (`status.change.invalid`, jornada03 J1: never
  a silent failure), the dispatch answers `refused`, the incident feed records the details, and development and tests
  throw.
- **The model's versions** (`src/core/document/migrations.ts`) are read at the only two boundaries (File › Open and
  the restored autosave): an older file is carried forward step by step, a newer one is refused by name, and a hole in
  the chain is a refusal with its reason.
- **History** stores patches and their inverses with the selection before and after, never snapshots; commands
  declared as coalescing merge inside a manifest window.
- **The async rule**: a door may await its *payload* (the files a person picked, the clipboard, an image's bytes) and
  let the command compute its placement from the state at dispatch — the command reads the document when it runs, so a
  payload cannot go stale. What may not happen is computing something **from the document or the layout** before an
  await and applying it after: exactly one site does that (an image file dropped on the canvas, whose place and target
  come from the measured page before the file is decoded), and it re-checks both against the document as it is —
  a target that is gone, or a parent that is, refuses with `status.stale` and clamps the index. Deferred callbacks
  (the side-drop dwell, the Layers row dwell, a field keeping its text one task later) each re-check the thing they
  captured. The audit of every `.then`/`await` in `src/` stands behind this paragraph; a second site of the
  compute-before-await kind must bring its own re-check.
- Ports keep the core testable and honest: the clock, ids, the layout (the only measurer), the CSS support question,
  the clipboard, downloads.

## The interface

- **Everything is a door.** Every button, menu item, field, handle, tile and shortcut is generated from a door in
  `manifest/commands/*.json`; there is no other keymap or button list. A door whose feature is not registered is
  drawn disabled with "not available yet" (proven by `src/editor/doors/door.test.tsx`); the context menu draws only
  what applies to the selection.
- **Disabled and focused, one look each.** A control that cannot act is `aria-disabled`, drawn in the subtle ink on
  its own container, with no hover plate, the not-allowed pointer and its reason in the tooltip — never faded with
  opacity, so its words stay legible. The keyboard's focus is one ring everywhere: 2 px of the focus colour, 1 px off
  the control; inside a strip whose edges clip it is drawn inset, and on the status bar in the bar's own ink
  (`src/editor/shell/shell.css`; jornada02 GRAMMAR R-40, G-13 to G-15).
- **Layers.** A popup that floats next to its control is a popover (`src/editor/shell/popover.tsx`): placed by
  `float.ts` inside the window, over the overlay backdrop, focused once placed, closed by a choice, a press outside or
  Escape, and the focus goes back to its control. A modal dialog (`dialog.tsx`, and the confirmation a command asks)
  takes the focus, keeps Tab inside it, closes on Escape — which answers a confirmation with Cancel — and gives the
  focus back to what opened it.
- Regions are declared in `manifest/layout.json` (top bar, sidebar views, canvas, inspector, dock, status bar, the
  overlays: palette, quick panel, colour picker, dialogs, rulers, chrome). The shell draws each region from its own
  file under `src/editor/shell/`.
- **The panel** (Style/Settings/Interactions) reads properties.json: sections, groups, pair rows, essential
  properties, applicability (`applies.ts`), the field's origin (`origin.ts`), the controls (`field/`). A field shows
  the document's value (empty with a muted placeholder when it has none), never a computed one, and nothing it shows
  depends on the canvas zoom.
- **The canvas** draws labels, handles and overlays over a page that never takes pointer events: the outline and
  label of the selection, drop indicators, gap and spacing bands, rulers, grids and fold lines. Labels never cover
  page text (the boxes come from `contentBoxes`); the label rule and the rest of the canvas contract are in the
  chrome's own header comments.
- **Colours, spacing, type, radii and shadows come only from the tokens** (`src/ui/tokens.css`, generated from
  `design/final/tokens.json`); the lint rules refuse a literal value in a stylesheet or a style object. UI text comes
  only from the i18n catalogues (en is the source, pt-BR ships), one term per concept.
- **Style presentation** follows the interactive states in `design/final/index.html`. `inspector.css` owns the
  compact label/value grid, paired cells, icon groups and box model. `field-face.tsx` formats the resting value and
  its origin; the real input retains its complete CSS text and existing commands. Pair membership, short prefixes
  and optional measured width/height hints are data in `properties.json` `rows`. Change those entries to rearrange
  a pair; change the shared CSS primitives to adjust density. Compare real Chrome captures after each visual change.
  A field is lean (jornada02 R-27, A.0): its value in the code role (12/18 mono), its unit as the unit menu's
  trigger (24 px wide, over the cell's end only while a keyword is hovered), a measured hint where the value is
  auto, and its Reset in its flow while hovered; it steps with its keys and its label's scrub. Every row, a pair's
  included, puts its values at the same x: the 100 px label column (`--size-label-column`).
- **A row never wraps its controls.** Keyword buttons whose words do not fit the value column become a keyword menu
  (measured, field.tsx `useFits`), and "Mixed" stands in the control's own cell. A values menu opens with its door's
  Essentials list (`adapter.offers.essentials`) and keeps the rest behind More values. A boolean attribute is an
  Off | On pair, never a checkbox. The Style tab groups a concept's longhands under one row (`conceptRows`,
  `inspector.toggleRow`) and says a lock once at its top.
- **The quick panel** reads its groups from `layout.json` `quickPanelGroups` (each quick-panel door names its
  `group`; rule `quick-panel-group`), names every field inside it (the door's `faceLabelKey`, else its label; its icon;
  a colour's swatch) and shows the inspector's resting faces.
- **The catalogue holds only what is named**: `tools/i18n/unused.test.ts` fails on a key no source names (by its text,
  its plural stem, or a template built from one of its prefixes), as `dedupe.test.ts` does on a key written twice.
- The shell's stylesheets load once each, from `src/main.tsx`, in this order: the tokens, `shell.css` (the base and
  the one focus ring), `primitives.css` (one owner per primitive: the door, the segmented control, the swatch, the
  matrix), then one stylesheet per region (`window.css` … `window-overlays.css`), which places and sizes them.

## The development loop

```
npm run check:fast        # the static gate: gen:check, manifest:check, inventory:check, typecheck, lint, unit (~1 min),
                          # every scenario's logic without a browser among them (tools/runner/headless.test.ts)
npm run ui -- <flow>      # drive the real app in Chrome with real gestures, a photo per step, failing on any error
npm run e2e:affected      # the browser tests of what changed: the features a change reaches, and their spec files
npm run e2e -- <spec>     # the tests of what the block built, at the end of a block
npm run e2e               # the complete suite, once, when the application is ready
npm run e2e:diagnose      # the failed tests again, with their trace
npm run e2e:tooth         # the tooth proof: a feature's handlers made no-ops must fail its tests
npm run inventory         # regenerate docs/INVENTORY.md and docs/inventory.json
```

- **Two scenario runners, one contract.** The fast runner (`tools/runner/headless.test.ts`, inside `check:fast`) runs
  every scenario through every door as the command and arguments the door hands, on the editor's own store in Node,
  and checks the refusals after their step, the document, the selection, the undo steps, the feedback and undo and
  redo — about 900 runs in two seconds. What only a browser proves stays with the browser runner
  (`tools/runner/scenarios.ts`, which remains the contract: every scenario through every door, in the real app): a
  gesture, a drop, a field that shapes typed text, a control that fills its arguments, the colour picker's session,
  and a run whose outcome depends on the page's layout or on the values the browser takes, which the fast runner
  reports as skipped with the reason.
- `npm run unit` measures what the unit tests and the fast runner reach of `src/core` and `src/editor`, line by line
  and branch by branch (`.cache/coverage/index.html`), and fails under the floors of `vitest.config.ts`, which are
  raised as tests are added and never lowered. What only the browser runner reaches (a gesture, the layout) counts
  there as unreached.
- **Visual baselines** (`tests/e2e/visual.spec.ts`): the editor, the Style and Settings tabs, the quick panel, the
  palette, a menu and the sidebar, in the light and the dark theme, compared with the pictures kept beside the spec. A
  change of the design system fails there until it is looked at and taken again on purpose
  (`npx playwright test visual --update-snapshots`).
- `npm run e2e:affected [--since <ref>] [--list]` follows runtime imports to built feature owners. Shared keyboard,
  pointer, core/editor store and door dispatch code reaches every browser test even when the inventory maps it to
  one feature: tests consume these owners through doors, not imports. Unmapped production sources (including CSS,
  JSON and removed files) also select the complete suite, with the reason printed; unknown reach never means no
  tests. Unit tests and declaration files alone do not trigger browser work; generated modules exporting runtime
  values are treated as production code. Narrow handlers retain their
  feature selection; propagation stops at the command-registration table. The shared test/manifest infrastructure
  still selects the whole suite. `--list` prints the exact Playwright arguments without starting a browser.
- A screen is not done until a photo shows it working: `npm run ui -- <flow>` (Playwright on the installed Chrome,
  never the editor's own preview pane) drives it with real gestures and writes one screenshot per step to
  `.cache/logs/ui-<flow>-<time>/`. It fails when the page logged a console error, when the incident feed holds
  anything, or when an expectation the flow states is not met.
- **Nothing stays hidden**: the incident feed (`src/core/incidents.ts`) records a validator breach, a window error, an
  unhandled rejection and a render React could not do; the status bar shows the count, and the read-only test port
  (`__builderTestPort`) carries the list, the document, the selection, the history and the explain surface.
- Tests enter through doors with the real mouse and keyboard, and assert end artifacts: the document JSON diff,
  computed style or geometry inside the frame, storage after an immediate reload, the files inside the exported ZIP.
  Never a proxy such as "it appeared on screen", and never only that something exists.
- Time budgets, measured: the static gate ~1 minute; one flow ≤ 30 seconds; the complete suite ≤ 10 minutes
  (Playwright uses a quarter of the machine's cores, from 2 to 6 workers, so the machine stays usable). The census (`tests/e2e/census.spec.ts`) is
  static: 256 built commands, 998 doors, every door of a built command run by a test — 6 seconds.

### Adding a feature

1. Write its scenario in `manifest/features/<group>.json` (setup, doors, expected document diff, selection, history,
   an end terminal, the refusals) and, when the behaviour needs words, its spec section. A behaviour change starts
   here, in the same commit as the code.
2. Declare its commands and doors in `manifest/commands/<domain>.json` — the door's adapter data (values, selection,
   properties) is data, never code.
3. Implement the handler in `src/core/` (pure, returning patches; a refusal for anything predictable), register it in
   `src/app/commands.ts`, and register the feature in `src/app/features.ts`.
4. Add its basic test (`src/**/*.test.ts`) and, when a screen is touched, a flow in `tools/ui/flows.ts`.
5. Prove the tooth: with the handler made a no-op the tests must fail; with it back they must pass.
6. `npm run check:fast`, then `npm run ui` (photos), then the block's specs, then commit.

## The state of the application (2026-10-01)

- Every command of the manifest is built; the two features left unregistered (`hover-measure`, `shortcuts-e2e-sweep`)
  bring no command and no door. The inventory counts 187 features (185 built), 261 commands, 1,006 doors, 1,343
  scenarios, 259 modules, 49,995 lines; every field of every manifest schema names a module that reads it.
- Green at this commit: `gen:check`, `manifest:check`, `inventory:check`, both typechecks, lint, 1,655 unit tests
  (the headless scenario runner among them) and the complete browser suite: **2,006 passed** in 11.9 minutes, no failure and no flake.
- The design-system chapter (the audit of jornada01/02 and its resolution plan: waves T, B/E/M, 0 to 6) is done. Its
  decisions, each recorded in its spec section:
  - **The bottom dock keeps its strip when closed**, as the canonical design draws it (jornada03 stage 5, replacing
    A3.18's status-bar icons): its tabs open the dock, the Checks tab with the number of issues, and the first issue
    beside them (spec dock-toggles).
  - **S-028 stays**: a whole border the parser cannot read is refused naming the part it guessed, which the scenario
    `a-side-colour-that-is-no-colour-is-refused` pins.
  - **T.2 (door reach batched in one page) is not built**: its aim was speed, met otherwise — the headless runner and
    `e2e:affected` for every commit, the complete suite in about 11 minutes on a quarter of the cores, stable — and a
    rewrite of the runner would risk that for a margin.
  - T7 stays deferred with its reason (the pointer's singletons matter only when two editors share a page).

## Rules that are never broken

- Never edit, skip or loosen a test or a scenario to make it pass; if one looks wrong, stop and say why.
- Never report something as working without the raw output or the screen that proves it.
- Never run two suites at once; the complete suite only when the whole application is ready.
- Code, file names, commits and documents in English; UI text only through the i18n catalogues.
- The product name appears only in `src/config/product.ts`.

### Repeating the large-page measurement

Run `npm run perf` without other browser tests, builds or unit suites running. It records the measurements and reports the budget separately; `npm run perf -- --enforce` fails when a measured action group exceeds its declared target. See `tests/perf/README.md` for the protocol, limitations, raw evidence and report-only rendering. This is a benchmark of selected interactions on the641-node fixture, not a replay of the entire Journey03 P1 task.
