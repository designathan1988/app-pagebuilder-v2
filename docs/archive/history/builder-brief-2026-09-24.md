Archived 2026-10-02 from `.memory/archive/builder-brief-earlier.md` (not versioned), the Portuguese messages translated:
the builder's briefs of 2026-09-24/25 (slice 1 and foundation part 1), in force at the time, superseded since by the
/goal of 2026-09-28 and the plan of 2026-10-01. History only.

# Builder brief (literal copies of the user's messages)

Everything below is copied word for word from the user's messages. The first part is in force now; the second is
the finished foundation part 1, kept as the user asked (where the run brief says otherwise, the run brief wins).
Replace the in-force part, also literally, when the user sends a new brief or /goal.

# IN FORCE (slice 1, 2026-09-24/25)

## Brief of slice 1 (literal)

Brief of slice 1. Read to the end and answer only "ready"; wait for the /goal.

WHY
The project is now done in one conversation per slice, without a continuous auditor, because the two-session method became too slow. The protections are in the repository and hold in this conversation: manifest:check, gen:check, lint, the door census, the manifest's scenarios and the tooth proof. This is the last slice with foundation work: it finishes the two pieces part 2 left half done and delivers the first block of group 02 the user can use in the app: select, insert from the palette, undo and redo, the layers tree and delete. Before starting, read PROGRESS.md (the handover at the top), CLAUDE.md, DESIGN.md and ARCHITECTURE.md.

RULES THAT ARE NOT BROKEN IN THIS SLICE
- The scenarios in manifest/features/ are the contract and you do not edit them. If you think a scenario is wrong, do not work around it: stop only that feature, record in PROGRESS.md which scenario, why and what you propose, go on with the features that do not depend on it and bring the case in the final report for the user to decide. The final report proves that no scenario was changed with git diff --stat 1b30b9c..HEAD -- manifest/features/, which has to come out empty.
- Every behaviour you switch on or change has a browser test that fails when it is switched off; show the tooth proof with the real output before each commit.
- Real output, complete, never summarised. No file change by regex; a mass change of JSON only by reading it as an object, showing how many entries it changes and checking with git diff --stat. Read-only scripts only, in .cache/scratch/, deleted at the end.
- Scope frozen to this brief. Whatever comes up outside it goes to PROGRESS.md under "Open findings", without being done.
- Do not ask the user what the project already answers; on a small ambiguity decide by what was already decided and record it in PROGRESS.md. Ask only what changes what the user sees or does.
- If the same thing fails three times with the same approach, stop and report.
- Helpers in parallel are authorised on the independent parts, each with its stretch of the brief word for word, touching only its own paths, without git and without regex; you are the one who commits.
- Commit and push after each item and each feature, always with verify:fast and e2e green: no commit leaves main red.
- Memory: keep .cache/memory/builder.md and copy this brief and the /goal literally into .cache/memory/builder-brief.md; reread both after any compaction. If this conversation is interrupted, a new conversation resumes from PROGRESS.md and that memory.

WHAT TO DO, IN THIS ORDER
1. Integrate wip/part2 into main (git merge --ff-only wip/part2, npm run gen, stage src/generated/commands.ts), push and delete the local and remote branch. In PROGRESS.md, close pending items 2, 3, 4 and 8 with the reason the auditor gave for each (the user's decision), and tie pending item 11 to the features that touch it: the "}" in a style value has to be resolved before the first feature that edits style through the inspector; target="_blank" with rel="noopener" before the first link feature; the line break in textarea and option before the first form feature.
2. Complete the scenario runner for everything the scenarios of group 02 use: setup with an initial selection, context, breakpoint, state and zoom; steps with a target, a drop, a held drag and typing. When the canvas does not draw, the runner fails by an assertion that says so, never by a timeout; prove it with a scenario of group 01 with the renderer switched off. If pending item 1 (the node path that does not name the page nor separate siblings with the same name) blocks any scenario of this slice, resolve it here.
3. Finish the foundation:
   - pointer.ts as the only owner of the gestures over the canvas, with gesture state machines. A lint rule refuses, outside pointer.ts, pointer, mouse and drag listeners and props (pointerdown, pointermove, pointerup, mouse*, drag*, onPointer*, onMouse*, onDrag*); the ordinary onClick of panel, menu and button controls stays allowed, because it is not a gesture over the canvas.
   - The undo transaction is opened by the door (store.gesture()), not by the handler, because forgetting to open the transaction is the most common undo bug in editors; a whole gesture becomes a single undo step.
   - A dependency rule refuses any module other than the renderer writing to the iframe's DOM or CSS.
   - Each rule proven by a planted violation that makes verify:fast fail and is then removed.
4. The features, in this order, each with its own commit:
   a) select-click.
   b) palette-click-insert and undo-redo together, in a single commit. Reason: as soon as the first command that changes the document exists, the census starts requiring undo and redo tested through every door (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, the bar's buttons, the Edit menu and the notice's Undo); separating the two would leave the suite red between the commits.
   c) layers-tree.
   d) delete-element.
   Each feature is ready only when all its scenarios pass in the runner, through the declared doors, with the tooth proof of each command (npm run e2e:tooth) and the census green.

## /goal of slice 1 (literal)

Slice 1 is ready: the brief's four items are committed and published on main, and the runner's status shows editor-shell, canvas-page-iframe, select-click, palette-click-insert, undo-redo, layers-tree and delete-element as "passes", or, for any of them, a contested scenario recorded in PROGRESS.md with the reason. The final report, in Portuguese and in this order, shows: 1) git diff --stat 1b30b9c..HEAD -- manifest/features/ empty; 2) the complete output of npm run verify:fast and npm run e2e on main with a clean tree, including the census and the status block; 3) the output of npm run e2e:tooth showing each scenario of the five new features failing with the handler switched off; 4) the real output of the proofs of items 2 and 3, including each planted violation; 5) screenshots of the app selecting an element, inserting from the palette, undoing, redoing and deleting; 6) the decisions taken on small ambiguities, the contested scenarios and the open pending items; 7) git log of the slice and a clean git status. If the same thing fails three times with the same approach, stop and report.

# EARLIER MESSAGES (in force only where the slice 1 brief does not say otherwise; nothing about the auditor applies)

## User decisions on the auditor report (2026-09-24, after 0ca4bb8; in force)

Stop at the next safe point and read to the end. The auditor's independent verification found more failures of yours, which you should have caught before committing: the dock (maximise and restore) has no browser test that fails when the handler is switched off, and the Styles panel opens empty, without the "not available yet" notice. The tooth-proof rule you received holds for everything: something delivered without a test that fails when it is switched off is something not delivered.
The user's decisions on the auditor's report. Do each with a separate commit (git commit --only -- <files>), push and a notice to the auditor with the real output:
1. Exclusion list: add display run-in, break-before all and break-after all to manifest/css-exclusions.json, with evidence of the kind "chrome" (CSS.supports returns false for each in Chrome), because Chrome does not even read them and the control would write a declaration the browser discards. Fix pending item 2 of PROGRESS.md to list only keywords the generated lists really offer.
2. Doors that open a panel without a feature: every door whose only effect is to open a panel whose feature does not exist yet appears disabled, with "not available yet", as CLAUDE.md says, because an enabled control that opens an empty panel promises what it does not do. It holds for Help › Keyboard shortcuts, View › Timeline, Checks and Variables, and for the Styles button of the activity bar while the Styles view is empty. The panels that exist (sidebar, Explorer and Layers, Insert, inspector, dock, canvas tools) stay enabled. Prove it with a test that fails when one of these doors is enabled.
3. setup.zoom: your proposal is accepted. setup.zoom is "fit" (the canvas as it opens, the frame fitted in the area) or one of the levels of environment.zoomLevels [25, 50, 100, 200, 400]; a number is allowed only after zoom-keyboard-buttons is built. Keep 100 accepted for one commit, so main stays green; the auditor switches the 132 scenarios to "fit", and then you remove the provisional 100.
4. Dock: write the browser test that fails when workspace.setWorkbenchState is switched off, with the tooth proof.
5. Permanent census: add to the suite a test that reads the manifest and the command registry and fails when a command with a real handler has no browser test bound to its id, or when a door appears enabled on the screen without a real handler. Prove that it fails by planting a command with a handler and without a test, and then removing it. Reason: it is the only way to know that no working command was left without proof, without depending on someone remembering.
Record these failures and rules in .cache/memory/builder.md. Then continue the brief where you stopped.

## User correction and rules (2026-09-24, after 454c764; in force, above every other text here)

Stop at the next safe point and read to the end before continuing. The user is dissatisfied with your work. The auditor's independent verification, done in its isolated copy, found failures you should have caught before committing:
1. In 2fc025f, the short text of the buttons ("+ Class" as door data) has no test that fails when it is switched off. The auditor replaced the implementation with nothing and everything stayed green. That is a false test by omission, exactly the defect that brought down the 20 previous attempts.
2. In 454c764, the exclusion list trusted only the compatibility data. In real Chrome, three keywords offered by the inspector are refused by CSS.supports: break-before: all, break-after: all and display: run-in. You did not check in the browser the product uses.
3. Before that: you inverted the All properties rule in b9d665c, and sent the auditor 3 lines of the output with "the other 26 did not change" instead of the real output that was asked for.

RULES, from now on, without exception:
A. Tooth proof before each commit, done by you: for each thing the commit switches on or changes, switch it off, run the tests and confirm that one fails; then switch it back on. If nothing fails, write the missing test before committing. In the message to the auditor, show the real output of the tests failing with the thing switched off and passing with it on.
B. The browser is the truth, not the data. Any value, property or behaviour the product offers needs to be confirmed in the installed Chrome, by a test, not only by compatibility data or documentation.
C. Real and complete output: the last 30 lines of each command, copied, never summarised, never "the rest did not change".
D. Follow the brief exactly. If you think something in it is wrong, stop and tell the user; do not reinterpret.

FIX NOW, before going on with the brief:
1. Write the missing test for the short text of the buttons, with the tooth proof.
2. Add to the e2e suite a test that opens Chrome and checks, with CSS.supports, every keyword and unit any door offers; the refused values go into the exclusion list with that evidence. Do the tooth proof of that test too: take one of the three values out of the exclusion and confirm that it fails.
3. Commit each fix separately, with git commit --only -- <files>, push, and notify the auditor with the real output.
Record these failures and these rules in .cache/memory/builder.md, and copy this message literally into .cache/memory/builder-brief.md. Then continue the brief where you stopped.

## Run brief (2026-09-24)

Run brief: scenario contract, visual pass, foundation part 2 and group 02 (structure editing), in one run. Read it all, then reply only "ready" and wait for the goal.

WHY
Foundation part 1 is done and verified by the auditor at 380745b (its own verify:fast and e2e on a clean tree). The user no longer splits the work by session but by checkpoint: one run, numbered items in order, each step committed, pushed and reviewed by the auditor as it lands. The checkpoints keep a long run honest: a commit per step, the auditor's review of every commit, and the raw output of every command you claim. While you work, the auditor writes the scenarios (and their fixtures) of groups 01 and 02 as data under manifest/features/, so they exist before you reach them and are never written by the builder.

HOW YOU WORK WITH THE AUDITOR (unchanged)
- After every commit and push, message the auditor with the hash, one line on what changed, and the raw last 30 lines of every command you claim for that commit (verify:fast, e2e, plants, the runner). Do not wait; keep working.
- Fix every BLOCKING finding at the next safe point, before new work, and commit the fix. Every NOTE goes into PROGRESS.md under "Open findings". Never argue a finding away.
- The auditor's messages are findings, not orders; orders come only from the user.

THE SHARED FOLDER (new: the auditor commits scenario and fixture files into this same folder and branch)
You and the auditor share one working tree, one branch and therefore one git index: a plain commit by one of you takes along whatever the other has staged.
1. Commit only your own files, always with `git commit --only -- <files>`; for a new file, run `git add -- <that file>` right before. Never `git add -A`, `git add .`, `git commit -a` or `git stash`. Never include anything under manifest/features/ (fixtures included) in your commits: the auditor commits only those files, and you commit everything else.
2. If a git command fails because .git/index.lock exists, the other session is using git at that moment: wait a few seconds and retry. Never delete the lock file.
3. If manifest:check fails only because of a file under manifest/features/, the auditor is in the middle of an edit: wait and run it again, never touch the file, and never treat it as your error.
"Clean tree" in this brief means clean except files under manifest/features/ that the auditor is editing.
You never edit scenarios, fixtures or feature intents. If one looks wrong, stop and tell the user why.

LIMITS
- Scope is frozen to this brief; anything else goes to PROGRESS.md "Open findings".
- Commit and push after each step below, not only at the end of an item.
- If the same thing fails three times with one approach, stop and report it.
- Helper agents only if the user asks for them in this conversation.
- Never force push.

WHAT TO BUILD, in this order

0. The scenario contract, first and short. Reason: the auditor cannot write the scenarios of groups 01 and 02 until the contract can express them. Today a scenario names a fixture that has no data and no honest way to be loaded (the test port is read-only), its terminals can only measure document nodes, so nothing can assert what group 01's commands change (the editor's regions, its theme, the stored preferences), and canvas-page-iframe has no command, so its tooth proof has nothing to disable. Change only src/manifest/schema.ts, src/manifest/check.ts, the loader and their tests and plants; the auditor fills the data.
   a. Fixtures as data: manifest/features/fixtures/<id>.json, each a project document in the model of src/core/document/model.ts. manifest:check validates every fixture against the model rules (validateDocument) and fails on a setup.fixture with no fixture file and on a node path, in setup or in expect, that does not resolve in the fixture (for expect, after the document diff is applied), each proven by a planted fixture. The id "empty" means a fresh profile's empty project and needs no file.
   b. How a fixture reaches the app: through a real door, File › Open (project.open, its menu-file door) with the browser's file chooser, as a user would. Never through the test port, a URL parameter or a boot flag, because any of those would be a load path outside the doors. So project.open (feature project-open-json) is built in part 2 as runner infrastructure; its own scenarios come with group 03.
   c. Terminals for the editor itself: expect.editor, which is either null or an object with regions (each: region id of layout.json, measure x|y|width|height, relation equals|less-than|greater-than, value, and a reference region or null) and computed (each: region, CSS property, value); and persistence.preferences ("same" or null) next to document, for what must survive an immediate reload. The scenario-terminal rule counts editor as an end terminal, proven by a planted fixture.
   d. Tooth proof for a feature without commands: an optional feature field (optional so that no features file has to change) naming the module the tooth proof replaces with a no-op. The auditor sets it for canvas-page-iframe (the renderer).
   Proof: verify:fast exit 0 and each new plant failing, raw.

1. Visual pass. Reason: seeing the shell, the user found it reads as direction A only. Decision: C "studio" gives the look; A gives the structure and its visual inspector controls, laid out in C's compact rows; Canvas stays the default view.
   a. design/final/ first, because DESIGN.md makes it the visual source and the shell must match it: update design/final/tokens.json and design/final/index.html to the new look, regenerate the shots, and npm run design:shots passes (English and pt-BR, light and dark). Then DESIGN.md ("Theme", "Density and tokens", "Build order"), and only then the shell.
   b. Dark theme by default for a fresh profile; View › Theme keeps Light, Dark and System. The default theme is data beside the default locale in manifest/environment.json, not a literal in preferences.ts.
   c. C's density: IDE-compact rows, heights and spacing, all from tokens.
   d. Monospace (the code font token) for code, file names, class names, tags and CSS values wherever they appear.
   e. A coloured status bar, as in C, with its background and on-colour as tokens that keep 4.5:1.
   f. A's visual inspector controls (alignment matrix, box model, segmented keyword buttons, value fields) in C's compact rows: a label column and a value column, one row per property.
   g. Open finding 29: where design/final shows a control's text different from its door label ("+ Class" for "Apply a class"), the short face text is door data (a face label key), never chosen in code.
   h. Open finding 23: DESIGN.md "Build order" says the Explorer shows only Layers before explorer-pages; the user keeps Pages and Files drawn with their doors disabled, so change that sentence to match.
   i. The exclusion list. Reason: BCD has no entry of its own for 3,530 keywords of the edited properties, and css-compat.json gives each the support of its property, so All properties offers values every browser parses but none implements: break-before, break-after and break-inside `region` and `avoid-region` (CSS Regions), and text-decoration `blink`. That is a control that does nothing, the failure this project exists to prevent. Declare an exclusion list as generator input (never a menu subset): each entry names the property, the keyword and its evidence (spec status, BCD, or the observed behaviour in Chrome), and npm run gen marks it unsupported in css-compat.json so it leaves every generated list. manifest:check fails on an entry without evidence and on an offered value that is on the list, each proven by a planted fixture. Exclude only those certain values; list every other inherited-only keyword you suspect in PROGRESS.md "Open findings" for the user to decide.
   Proof: verify:fast exit 0; design:shots exit 0; the plants failing; e2e including a fresh profile that opens in Dark and keeps a changed theme after an immediate reload; screenshots of npm run dev at 1440 px, light and dark, next to the updated design/final shots.

2. Foundation part 2, lean: only what groups 01 and 02 need. Fonts, images, the preview origin, animations and export arrive with the groups that need them.
   a. The canvas: a same-origin iframe that only renders. The renderer (src/core/render/render.ts, ARCHITECTURE.md) is the one writer of the page's HTML and CSS from the document JSON and applies each transaction's patches to the iframe's DOM, never re-rendering the whole page for a change. The iframe has no event handlers of its own.
   b. Zoom and coordinates: the frame is scaled with Chrome 128+'s standardized CSS zoom. The coordinates module (src/editor/canvas/coordinates.ts) converts between page, frame and screen at any zoom. environment.json zoomLevels (today 50, 100, 200) covers 25 to 400 percent, and a click on a page point hits the right element at every level, tested from 25 to 400.
   c. Pointer input: all of it arrives on an overlay in the host page above the iframe (the iframe takes no pointer events). One pointer owner (src/editor/input/pointer.ts) runs explicit gesture state machines whose thresholds are interactions.json constants.
   d. Undo per gesture: the door opens the transaction (store.gesture()) when the gesture starts and commits or cancels it when it ends; a handler never opens or closes one. Reason: a forgotten history mark is the most common undo bug in editors, and one owner removes it.
   e. The read-only test port (src/editor/test-port.ts): it reads the document, the selection, the history and the export, and never writes, loads, creates or selects anything; a test proves it exposes no write.
   f. project.open through File › Open, reading the project document format the fixtures use, so the runner can load a fixture through the door (item 0b).
   g. npm run e2e is generated from the manifest scenarios (tools/runner/scenarios.ts): one Playwright test per scenario and per door it names, on the installed Chrome, loading its fixture through File › Open, entering only through doors with the real mouse and keyboard, asserting the end terminals (the document JSON diff read through the test port, computed style or geometry inside the frame, the editor terminals, storage after an immediate reload) and the refusals. The tooth proof is part of the runner: for each feature it replaces the feature's command handlers (or the module the feature names) with no-ops, runs its scenarios and requires them to fail. A feature's status is derived from the results at the current commit on a clean tree and printed by the runner; it is never written anywhere.
   h. Done when the runner passes every scenario of group 01 (editor-shell, canvas-page-iframe, written by the auditor) through every door, and the tooth proof fails each of them.
   Proof: the runner's raw output for group 01, passing and then failing under the tooth proof; the coordinate tests from 25 to 400; verify:fast and e2e exit 0.

3. Group 02, structure editing (manifest/features/02-structure-editing.json). Start only when the auditor's scenario commit for group 02 is in git log; if it is not there yet, stop and tell the user. Build the commands and doors feature by feature, in file order, until the runner passes every scenario through every door. The corrections under "Problems in Pager" in each feature's spec are requirements. Commit, push and notify after each feature, with the runner's raw output for that feature and its tooth proof.

Update PROGRESS.md as you go. Work directly; no plans or summaries beyond what is asked.

## Addendum to item 0 of the run brief

Addendum to item 0 of the run brief (the scenario contract). Reason: starting to write group 02, the auditor found that a scenario still cannot say what to do: it names doors but no action, no arguments (which palette tile, which node, where to drop) and no sequence of steps, and its document paths have no defined grammar. If item 0 is not committed yet, include this in it; if it is, do this as the next step, before item 1 continues. Change only the schema, manifest:check, the loader and their tests and plants; the auditor writes the data.
e. Steps: a scenario gets `steps`, executed in order after the fixture is loaded. Each step is { door, args, target, drop }: door is a door reference; args are the command's arguments as data, checked against the command's args in the manifest (for element.insert, entry is a palette entry id: the runner clicks that entry's tile); target is the node path the gesture acts on, or null; drop is null or { placement: before|after|inside, reference: node path } for a drag. Exactly one step is the action step (action: true), and the scenario's `doors` lists the alternative doors for it: the runner runs the scenario once per listed door, putting that door in the action step. Every other step names one door. manifest:check fails on a step whose door, args or node paths do not resolve, and on a feature where a door of its own commands (a door whose feature is that feature) appears in no scenario, each proven by a planted fixture.
f. Document paths: a node path is the node names from the fixture's root (/Page/Section); a field of a node follows /@ (/Page/Section/@styles/desktop/base/padding-top). A node value in expect.document omits id (ids are generated), and its children array gives their order. manifest:check resolves every path after applying the diff to the fixture, proven by a planted fixture.
g. The message the palette-click-insert intent names, status.placed ("Placed {element} in {parent}, position {position} of {count}."), goes into en.json and pt-BR.json, so scenarios can expect it as feedback.

## Memory instruction

Create now, at the next safe point and before continuing the item in progress, this session's memory. Reason: when the conversation is compacted automatically, the brief, the /goal and the user's decisions become a summary and get lost, and CLAUDE.md is the only thing that always comes back; without a memory on disk you repeat errors and reopen decisions already taken.
1. Create the folder .cache/memory/ (it is already ignored by git, so it never enters the commits nor competes for the index with the auditor) and inside it:
   - builder-brief.md: the literal copy, word for word, of the brief of part 1, the ARCHITECTURE.md addendum, the icons addendum, the authorisation of the helpers, the corrections coming from the auditor and the /goal in force. When the user sends a new brief or /goal, replace it with that, also literally.
   - builder.md, with at most 60 lines, rewritten whole at each update: the current item and the concrete next step; the last commit and what it proved; the user's decisions not yet recorded in DESIGN.md, ARCHITECTURE.md or the manifest; approaches that already failed, with the reason; the auditor's findings still open; the rules for living together with the auditor (commit only with git commit --only -- <files>, never git add -A, git add ., git commit -a or git stash, never include manifest/features/, wait and retry if there is an index.lock, manifest:check failing only in manifest/features/ is the auditor editing).
2. Update builder.md after each commit, after each message from the auditor and after each decision of the user.
3. Add to CLAUDE.md a short "Memory" section: at the start of each session and whenever the conversation has been compacted (a summary replaced the earlier messages) or you are not sure what was decided, before any action, read your role's memory: the builder reads .cache/memory/builder-brief.md and .cache/memory/builder.md; the auditor reads .cache/memory/auditor-brief.md and .cache/memory/auditor.md. If the memory contradicts your recollection, the memory holds. Commit only CLAUDE.md, with git commit --only -- CLAUDE.md, push and notify the auditor with the real output.
Then continue exactly where you stopped.

## /goal in force

The run is done within its limits: (0) the scenario contract is committed: fixtures as data under manifest/features/fixtures/ validated by manifest:check, loaded only through File › Open, editor terminals and persisted preferences in the scenario schema, and a tooth-proof target for a feature without commands, each rule proven by a planted fixture. (1) The visual pass is committed: design/final updated first and npm run design:shots passing; a fresh profile opens in Dark with Light, Dark and System in View › Theme and the default theme as data; C's density; monospace for code, file names, classes and CSS values; a coloured status bar from tokens; A's inspector controls in compact rows; the face text of a control as door data; DESIGN.md updated; and the exclusion list in the generator with its manifest:check rule proven by planted fixtures. (2) Foundation part 2 is committed: a same-origin iframe canvas whose renderer applies patches, coordinates correct from 25% to 400% zoom, every pointer input on the host overlay through one pointer owner with gesture state machines, undo transactions opened by the door, the read-only test port, project.open through File › Open, and npm run e2e generated from the manifest scenarios through the doors with the real mouse and keyboard, with the tooth proof and the derived status, passing group 01. (3) Every feature of group 02 passes all its scenarios through every door, each with its tooth proof. Shown in this conversation: for each commit, the raw last 30 lines of every command claimed; screenshots at 1440 px, light and dark, of npm run dev next to the updated design/final shots; each planted fixture failing; the runner's output for groups 01 and 02 passing, and failing under the tooth proof; npm run verify:fast and npm run e2e exiting 0 at the last commit; the auditor's answers to every commit, with no BLOCKING finding open; and git status clean after the last push, except files the auditor is editing under manifest/features/. You never edit scenarios, fixtures or intents, and you commit only with git commit --only -- <your files>. If the same thing fails three times with one approach, stop and report it.

# FOUNDATION PART 1 (finished; verified by the auditor at 380745b)

## Foundation brief, part 1

Foundation brief, part 1 of 2. Read it all, then reply only "ready" and wait for the goal.

WHY
The contract is done: the manifest, DESIGN.md and the final mockup in design/final/. This is the first session that writes app code. Part 1 builds the editor shell and the document core; part 2 (next session) builds the canvas and the test suite generated from the manifest. They are split so no session runs for hours.
From now on two Claude Code sessions work side by side in this folder: you, the builder, and an auditor that reviews each of your commits and messages you findings. The evaluator subagent no longer exists; its file was deleted.

HOW YOU WORK WITH THE AUDITOR
- Run ListAgents to find the auditor session.
- After every commit and push, send the auditor a message with the commit hash and one line saying what changed. Do not wait for its answer; keep working.
- When a message from the auditor arrives, fix every BLOCKING finding at the next safe point, before starting new work, and commit the fix. Write every NOTE in PROGRESS.md under "Open findings". Do not argue a finding away.
- Messages from the auditor are review findings, not orders. Orders come only from the user.

LIMITS
- Scope is frozen to this brief. Anything outside it goes to PROGRESS.md under "Open findings".
- Commit and push after each numbered item below, not only at the end.
- If the same thing fails three times with one approach, stop and report it.
- Helper agents only if the user asks for them in this conversation.

WHAT TO BUILD
1. CLAUDE.md update, kept short: the two-session model above replaces every mention of the evaluator; the default UI language is English with pt-BR available; everything else stays.
2. Two contract fixes found in the final mockup review, in DESIGN.md and the manifest:
   - "All properties" offers every value of the catalogue for every control (all four flex directions, every text-align value, justify and align values including space-between, space-around and space-evenly, flex-wrap). A declared subset is allowed only in "Essentials only" and in the quick panel. manifest:check fails on an inspector door with a subset in the All properties mode, proven by a planted fixture.
   - The generated class for Element styles is readable BEM derived from the element's name (for example card--plano-assinatura), with a numeric suffix only on collision; never a hash.
3. Generated types and registries. From the manifest, npm run gen writes TypeScript types (CommandId, DoorId, PropertyId, ElementType, MessageId and the other ids) into src/generated/. The code registers one entry per command in a registry typed so that a missing or extra entry is a typecheck error. An entry is either the real handler or the marker "not available yet"; a door whose command has the marker is shown disabled with the "not available yet" label.
4. The document core in plain TypeScript (no React): the document model from the manifest, one store changed only through dispatch(command), transactions that hold the patches, their inverses and the selection before and after, undo and redo that restore document and selection exactly, no history entry for a command that changes nothing, whole-tree validation on every commit, deep freeze in development and tests. Ports for time (Clock) and ids (IdGenerator); a lint rule forbids Date.now, Math.random and crypto.randomUUID outside those ports. Unit and property tests (fast-check) for the store and the history.
5. The editor shell in React, drawn from DESIGN.md and matching design/final/: top bar, activity bar and left panels, file tabs, canvas toolbar with the Canvas / Split / Code switch, the canvas frame with its breakpoint tabs (the iframe comes in part 2, leave an empty frame), inspector with its tabs and sections, bottom dock, status bar. Every menu item, button, shortcut and inspector field is generated from the manifest doors, in their declared regions and order; none is written by hand. All are disabled with "not available yet" except the ones whose commands this part implements (undo, redo, language switch, theme, dock and panel toggles).
6. i18n runtime (English default, pt-BR) and tokens: the UI reads src/ui/tokens.css only. Lint rules fail on a literal colour, spacing or font value outside the tokens and on a literal UI string outside the i18n catalogues, each proven by a planted violation that fails npm run verify:fast and is then removed.
7. Test speed: the manifest tests stop copying css-compat.json into each fixture; they read it once.
Update PROGRESS.md. Work directly; no plans or summaries beyond what is asked.

## Addendum: ARCHITECTURE.md (item 8)

Addendum to the foundation brief, part 1. Read it before the goal arrives; reply only "ready".
Reason: the auditor cannot check "one owner per concept" without ARCHITECTURE.md, which CLAUDE.md already depends on and which does not exist yet; and the deletion of the evaluator agent is still uncommitted.
- Item 1 also commits the deletion of .claude/agents/evaluator.md, and CLAUDE.md no longer names any evaluator.
- New item 8: ARCHITECTURE.md, short. For each concept this part builds, one line with the owner module path, its responsibility and what it must never do: generated types and registries, command registry and the "not available yet" marker, document model, store and dispatch, transactions and history, validation, Clock and IdGenerator ports, i18n runtime, tokens, the shell regions, door rendering from the manifest. Concepts that belong to part 2 (canvas iframe, renderer, coordinates under zoom, pointer input owner, test suite from the manifest) are listed with the word "planned" and their future path. Command owners declared in the manifest must match the paths in ARCHITECTURE.md, and manifest:check fails when they differ, proven by a planted fixture.
- Commit and push ARCHITECTURE.md as its own item and notify the auditor like every other commit.

## Corrections from the auditor's review

Two corrections from the auditor's review, apply them at the next safe point before new work.
1. The All properties rule was inverted in b9d665c. Reason: the intent was that Essentials only may offer fewer values, never that All properties loses anything. All properties offers every value the browser data allows plus every preset Essentials only has (font stacks, named weights 100 to 900, the background-size, transform-origin and will-change presets and any other). Essentials only is always a subset of All properties. manifest:check fails when an Essentials only value is missing from All properties for the same door, proven by a planted fixture. The typography feature intent at manifest/features/04-inspector.json:333 must hold again. Commit, push and notify the auditor.
2. Raw output, not summaries. Reason: the auditor cannot rerun checks at a given commit while unfinished work sits in the folder, so a summary like "verify:fast exit 0, 84 tests" cannot be verified. From now on every message to the auditor includes the raw tail (the last 30 lines) of every command it claims, for that commit.

## Addendum: door icons, before item 5

Before item 5 (the shell), add the doors' icons to the contract. Reason: the manifest declares each door, but not its icon, so the shell would have to choose icons in the code, which breaks the rule that every door comes from the manifest; the auditor pointed that out before it happened.
- Choose a single icon library for the whole editor, record it in DESIGN.md and take each icon from what design/final/ already draws.
- Every door that shows an icon declares the icon's name in the manifest (toolbar, activity bar, panel buttons, context menu items that show an icon, inspector controls drawn as icon buttons).
- manifest:check fails on an icon name that does not exist in the library and on a toolbar or panel-button door without an icon, each rule proven by a planted fixture.
- The shell reads the icons only from the manifest; no icon is chosen in component code.
Commit, push and notify the auditor, with the real output of the commands, before starting item 5.

## Authorization of helper agents

The user authorises helper agents to speed up part 1. Reason: the rest of the part has work independent of each other that can move in parallel, and the user wants part 1 ready faster, without losing rigour.
Divide it like this:
- You continue on items 3b and 4 (the command registry and the document core in src/core/ and src/app/).
- Helper 1: the icons addendum (a single library recorded in DESIGN.md, the icon name declared in each door that shows an icon, manifest:check rules with planted fixtures). It touches only manifest/, DESIGN.md and the files of manifest:check and its tests.
- Helper 2: item 6 (the i18n runtime with English by default and pt-BR, tokens read only from src/ui/tokens.css, lint rules against literal colour, spacing and font and against literal interface text, each rule proven by a planted violation). It touches only src/i18n/, src/ui/ and the lint configuration.
Rules for the helpers, which you pass to each word for word together with the stretch of the brief of its item, because they do not see this conversation nor CLAUDE.md:
- Touch only the paths of your item; never src/core/, src/app/ nor the other helper's files.
- Never run git add, commit or push; you are the one who commits.
- Do not run npm run gen at the same time as another; when needed, ask you.
- When finished, answer with the list of changed files and the real output (the last 30 lines) of each command that proves the item.
When each helper answers: check the files, run verify:fast, commit that item separately, push, and notify the auditor with the real output, as always. Item 5 (the shell) starts only after the icons commit is made and reviewed.

## User answer on the census (2026-09-24, in force)

Question: history.undo and history.redo have real handlers, but no Chrome test can run them yet (nothing built changes the document). How should the census treat them?
Answer: "Prove unavailable (Recommended)": Until the manifest has a built undoable command (history.undoable + a registered handler: none today), the census accepts for Undo/Redo a Chrome test that runs every Undo/Redo door and shows each is disabled with 'Nothing to undo' and changes nothing. From the first undoable command on, it demands a test through those doors that undoes and redoes. Derived from the manifest, no list in code.

## User message (2026-09-24, after 7cb737c; in force, replaces decision 2)

Two things, in this order, before item 2 of the foundation:
1. Fix first the 7cb737c blocker the auditor sent. Reason: CLAUDE.md requires closing every BLOCKING before new work, and the census that only looks at the initial screen and the menus does not fulfil the user's decision 5, because it let 74 enabled Insert-panel blocks without a command pass green. The census needs to open each panel the built doors can open before counting the doors, and that needs to be proven: enable on purpose an Insert block without a command and show the census failing.
2. Correction of the user's decision 2. The report it was based on was wrong: in a92d782 the Timeline tab drew the 18 doors the manifest puts in the region dock-timeline, all disabled with "not available yet", and the Styles view drew the door tokens.create#variables-add, disabled. Only Keyboard shortcuts was really empty, and Checks showed "No issues" without any check running. This replaces decision 2:
   - The Timeline and the Styles view come back, drawn from the manifest's regions dock-timeline and styles, with every door disabled with "not available yet". The doors that open them (View › Timeline and the Styles button of the activity bar), whose command workspace.setPanelOpen is built, become enabled again.
   - Checks stays as f1c41fc left it, without an invented result, and View › Checks stays disabled with "not available yet", because no check exists.
   - Keyboard shortcuts stays disabled with "not available yet".
   - A test in Chrome, through the real doors, opens Timeline and Styles, finds the 19 doors disabled with the reason, confirms Checks and Shortcuts disabled, and fails if these panels are removed again.
   Reason: these panels are where the doors of future features wait, disabled, for the user to see what is still missing; hiding them hides that.
Each item with a separate commit (git commit --only -- <files>), push and a notice to the auditor with the real output.

## User order: change of pace (2026-09-24, after 094eec8; in force, above the run brief's pacing)

Change of pace, the user's order. Reason: the project is moving too slowly and the user needs to see the editor working; part 1 is already solid and what remains in it is small. From now on, the objective is to reach the usable editor (part 2 and group 02) without unnecessary stops, without losing the proof.
1. Close quickly what is missing from part 1: the census blocker (open the panels the built doors open before counting, proven with an Insert block enabled on purpose) and the return of the Timeline and Styles with their doors disabled. One commit each.
2. Then go straight on to part 2 and group 02, without stopping between one and the other.
3. Use helper agents in parallel, authorised by the user, on the independent pieces of part 2: one helper for the coordinates module with Chrome's standardised zoom (tested from 25% to 400%), another for the iframe renderer that applies the patches to the DOM. You keep the pointer input layer, the gesture state machines, the undo transaction opened by the door and the e2e suite generated from the scenarios. Pass each helper its stretch of the brief word for word and the rules: only its paths, never git add, commit or push, no regex to change files, real output when finished. You are the one who commits.
4. Do not stop to ask the user what CLAUDE.md, DESIGN.md, ARCHITECTURE.md, the manifest or the specs already answer. On a small ambiguity, choose what is most coherent with what was already decided, go on and record the decision in PROGRESS.md. Stop only for a product decision that really is the user's.
5. The auditor's findings: you fix BLOCKINGs when you finish the numbered item you are on, all together, before the next item; do not interrupt the item in the middle. A NOTE goes only to PROGRESS.md.
6. No perfectionism: no test, rule or check beyond what the brief and the scenarios require. The tooth proof and the real output stay mandatory.
Commit and push per item, with a notice to the auditor and the real output, as always.

## User correction of the pacing order (2026-09-24; in force, above the pacing order)

Correction of the previous message about pace: three points of it were too loose and now hold this way. Reason: loosening the proof is exactly what brought down the 20 previous attempts; the speed gain comes from the helpers in parallel and from not stopping for questions, never from proving less.
1. Every behaviour your commit switches on or changes has a browser test that fails when it is switched off, with the tooth proof shown in the real output, even if no scenario covers it. "No perfectionism" means only not creating new process (rules, checks or tools the brief does not ask for); it never means leaving behaviour without a test.
2. The auditor's BLOCKING: if it hits code the current item depends on, or something you will still use, fix it at once, before writing anything more on top. The other BLOCKINGs you fix at the end of the item, and you never start the next item with any BLOCKING open.
3. Decisions you take on a small ambiguity go to PROGRESS.md with the reason, and the auditor reviews them like any other finding. Any decision that changes what the user sees or does in the editor is not a small ambiguity: stop and ask the user.
The rest of the previous message still holds: close what is missing from part 1, go on to part 2 and group 02, use the helpers in parallel, and do not stop to ask what the project already answers. Record this in .cache/memory/builder.md.

## User decision on open finding 10 (2026-09-24; in force)

The user's decision on pending item 10: an item of the View menu that toggles a dock panel shows that panel when it is not visible, and only hides it when it is visible. In a fresh profile, the Timeline is a tab of the collapsed dock, so View › Timeline opens the dock on the Timeline tab; clicking again with the Timeline showing removes the tab. The same holds for every dock panel toggled by the View menu. Reason: whoever chooses Timeline in the menu expects to see the Timeline, not to lose its tab. Prove it with a browser test, through the View › Timeline door, that fails if the first click removes the tab, with the tooth proof; update with it waiting-panels.spec, which today confirms the two-click behaviour. Do it when you finish the item you are on, with a separate commit, a push and a notice to the auditor with the real output.

## User order: end of the two-session method (2026-09-25; in force, above everything earlier about the auditor)

Closing of this conversation, the user's order: the project is now done in one conversation per slice of work, without a continuous auditor. Reason: the two-session method became too slow; the protections that matter (manifest:check, gen:check, lint, the door census, scenarios, the tooth proof) are already in the repository and keep holding in any conversation.
1. Stop at the next safe point. End the helper agents, receiving what each finished.
2. Commit only what is complete and passing verify:fast and e2e. Whatever is half done goes to a separate branch, wip/part2, with a "WIP:" commit and a push, so main stays green.
3. Update CLAUDE.md to the new model: take out every mention of the auditor and of the messages between sessions; keep every other rule (the tooth proof with real output before each commit, real output complete and never summarised, no file change by regex, read-only scripts in .cache/scratch/, never edit scenarios, the door census green, memory in .cache/memory/ reread after compaction).
4. Update PROGRESS.md with a handover: what of part 2 is ready and committed; what is in wip/part2 and how to resume; the user's pending decisions (pending item 10 of the View menu); and the auditor's findings still open, which it will send you or which you already have.
5. Run verify:fast and e2e on main and show the complete real output. Push.
Finish by showing git log -5 on main, git branch, and the summary in Portuguese of what is ready and what is missing.
