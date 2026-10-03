Archived 2026-10-02 from `.memory/archive/builder-brief-old.md` (not versioned), translated from Portuguese: the orders of
2026-09-25/26 that later orders replaced (each section says what replaced it). History only; nothing here is in force.

# Builder brief: orders a later one replaced (literal; not imported)

## Brief · OBJECTIVE

Replaced by: the /goal of 2026-09-25 (last) and, for "Stop only for a decision", the order of 2026-09-26 item 2 (you
decide).

OBJECTIVE
Build every feature of manifest/features/ (groups 01 to 20), until each one is "passes" in the runner's status or
recorded in PROGRESS.md as stuck, with the reason. Do not stop between features nor between groups, and do not ask
whether to continue. Stop only for a decision that changes what the user sees or does, or when the same thing fails
three times.

## Brief · BEFORE EVERYTHING

Replaced by: done (the brief is kept here; the memory is kept after every commit).

BEFORE EVERYTHING
1. Save this brief and the /goal, literally, in .memory/builder-brief.md (replacing the content). Keep .memory/builder.md
   updated after each commit: it is through it that you continue after each compaction.
2. Read only CLAUDE.md, PROGRESS.md and section 5 of reference/report.txt. For each feature, read its entry in the
   manifest, the scenarios, the spec and the sections of DESIGN.md and ARCHITECTURE.md it touches. Nothing beyond that.

## Brief · CPU

Replaced by: the CPU correction, then "Do not create any more agents" (/goal 2026-09-25); one suite at a time stays in
CLAUDE.md.

CPU (the user's PC freezes; rules without exception)
- No helper agents.
- First commit: playwright.config.ts reads the workers from E2E_WORKERS, with a default of 4.
- Never two suites at the same time, never e2e in the background, never npm run dev open while a suite runs.
- While building, run only the feature's tests; the complete suite only before the commit.

## Brief · THE STATE YOU INHERIT

Replaced by: history: the branches were integrated.

THE STATE YOU INHERIT
- main at 9bf3640, with 17 features passing (group 01 and 15 of group 02).
- In the main folder there are staged files of text-edit-inline, identical to the published branch
  feature/text-edit-inline (15fb11c), plus PROGRESS.md and docs/history.md modified. Other published and unintegrated
  branches: feature/palette-drag-insert, feature/drag-level-keys-escape and feature/hand-keyboard-move; old worktrees in
  .cache/wt/.
- Integrate each branch through the same checks as a new feature. Lose nothing; delete a worktree or a branch only after
  integrating it.

## Brief · FIRST TASK

Replaced by: done (the feature table and the door rule; finding 40 closed by the order of 2026-09-26 item 3).

FIRST TASK: THE RULE THAT PREVENTS THE CONTROL THAT DOES NOTHING
Today a door is enabled when its command exists, and that is why the 21 Insert templates are enabled and insert only an
empty box ("Hero" becomes an empty section, "List, 3 items" a ul without items, "Table 2 × 2" an empty table).
- Create the table of built features, with the same design as the command table: each feature is registered as built
  or NOT_AVAILABLE_YET, and the owner goes into ARCHITECTURE.md.
- A door, or an Insert tile, is enabled only when its feature (door.feature or the feature of the palette entry) is
  registered as built.
- The census starts failing a registered feature whose scenarios do not pass, or that has no scenarios.
- Prove it with the planted violation: an enabled template makes the census fail. Then remove the violation.
- Fix also the inspector, which says "Nothing selected" with an element selected: no panel states something that
  contradicts the store.
- Each fix with a browser test and the tooth proof.

## Brief · ORDER (and DEPENDENCIES)

Replaced by: the user's correction about the order (2026-09-25).

ORDER
1. The first task above.
2. text-edit-inline and palette-drag-insert, from the branches.
3. A usable editor first: autosave-restore, project-save-json, inspector-panel, inspector-number-fields, props-spacing,
   props-typography, color-picker, props-background, props-size-overflow, props-flex-container, elements-text,
   elements-structure, elements-media-images, elements-form-structure, export-zip and export-bem-css.
4. Then, everything else, group by group in the manifest's order (02 to 20), skipping what already passes. Integrate the
   branches drag-level-keys-escape and hand-keyboard-move when their turn comes.
DEPENDENCIES: if a feature of the ORDER depends on another not yet built (by the manifest or by the scenarios, for example
inspector-number-fields depends on inspector-panel), build the dependency first, with the same checks. Reason: item 3
jumps between groups, and building out of order would leave scenarios with no way to run.

## Brief · FOR EACH FEATURE

Replaced by: the corrections about the frequency of the tests, "stop testing at every stage", and the saving routine.

FOR EACH FEATURE
1. Without scenarios (from group 03 on there are none): write first the spec, if missing, and the scenarios, from the
   intent and the spec. Each scenario has a setup, doors, a document diff, a selection, history, at least one end
   terminal and the refusals. The scenarios cover every door the feature declares in the manifest (shortcut, menu,
   button, field, drag, handle), the refusals the spec foresees and the undo; never only the happy path. Reason: whoever
   writes the scenario and whoever builds is the same conversation, and a scenario that covers little is the easiest
   way for a weak test to pass; the complete coverage of the doors is what prevents that. manifest:check green. Commit
   only the spec and the scenarios, before any code. Afterwards do not change them; if one is wrong, record it in
   PROGRESS.md and go on with the next one that does not depend on it.
2. Build until every scenario passes through the declared doors, and register the feature as built.
3. Tooth proof: handler switched off, each scenario FAILS by an assertion, never by a timeout; switched back on, it passes.
4. Real use: with the suite stopped, open the app and use the feature with the mouse and the keyboard. Every control it
   enables has to do what it promises.
5. Before the commit, one command at a time: spec and scenarios committed untouched; npm run verify:fast; npm run e2e with
   the census green; npm run e2e:tooth <id>; status "passes". Complete logs in .cache/logs/; in the chat, only the exit
   code, the tests that failed and the last 10 lines.
6. A commit naming the feature, and push. Update PROGRESS.md (at most 60 lines) and the memory.
7. At each finished group, and at the end of item 3 of the ORDER, send the user, in Portuguese and in at most 8 lines:
   what they can do now in the app and how, and the stuck features with the reason for each.

## Brief · LIMITS

Replaced by: the order of 2026-09-26 item 2 (a scenario updated only when a built feature changed its behaviour; you
decide).

LIMITS
- Never edit an already committed spec or scenario, nor a fixture. Never force push. No change by regex.
- Three failures with the same approach: the feature stuck in PROGRESS.md, with the reason, and go on to the next one
  that does not depend on it.
- Small ambiguity: decide by what was already decided and record it in PROGRESS.md. A decision that changes what the
  user sees or does: ask.

## /goal (first)

Replaced by: the later /goals.

## /goal

The complete application is done: every feature of manifest/features/ is "passes" in the runner's status, with its
tooth proof, or recorded in PROGRESS.md as stuck, with the reason. No door appears enabled without its feature built. In
the open app, the user builds a page, edits text and style, reloads without losing anything and exports the ZIP. git
status clean and e2e green on main. If the same thing fails three times with the same approach, stop and report.

## The user's correction to the CPU rule

Replaced by: "Do not create any more agents" (/goal 2026-09-25).

## The user's correction to the CPU rule (in force)

The user's correction to the brief's CPU rule: helper agents are allowed, up to 3 at the same time, with these
conditions. Reason: what freezes the user's PC is the tests' Chrome running in parallel, not the helpers writing; this
way the work moves in parallel and the CPU keeps a single suite at a time.
1. Each helper works in its own copy (a git worktree in .cache/wt/<feature>, branch feature/<feature> from the current
   main) and only writes: the spec, the scenarios and the code of its feature, following the whole brief.
2. No helper runs npm run e2e, e2e:tooth, npm run dev or anything that opens Chrome. It may run npm run verify:fast in its
   copy, one at a time with you, never at the same time as a suite of yours.
3. You run every browser test, one command at a time, in the usual order, and only you integrate and commit. Before
   handing back, each helper brings the current main into its own branch and resolves the conflicts.
4. Open helpers in parallel only for features that do not touch the same central files (store, pointer.ts, command
   registry, chrome.tsx) another active helper is touching.
5. A feature's scenarios are committed before its code, as the brief says, even when a helper writes them.
Save this correction in .memory/builder-brief.md.

## The user's decisions (2026-09-25) · 1

Replaced by: the order of 2026-09-26 item 4 (the ids exception only for what replaces the document).

1. project-open-json: I accept proposal 2. The runner does not compare the ids of the page and the root when the action
   replaces the whole document (File › Open). Then release the door rule (wip/feature-table) with the usual checks.

## The user's decisions (2026-09-25) · 2

Replaced by: done: the one scenario edit it authorised was made.

2. drag-level-keys-escape: accepted. The first step of arrow-up-at-the-top-level-is-refused drops "before Footer", with
   the same expectations. This is the only authorised scenario edit.

## The user's decisions (2026-09-25) · Priority

Replaced by: the user's correction about the order (2026-09-25).

Priority: from now on the style path comes before anything else (inspector-number-fields, props-spacing,
props-typography, color-picker, props-background, props-size-overflow, props-flex-container). The helpers may advance
the others, but you integrate the style ones first.

## The user's decision: speed up without losing rigour

Replaced by: its item 1 done; items 2-4 replaced by the block testing corrections and "Do not create any more agents".

## The user's decision: speed up without losing rigour (2026-09-25, literal, in force; replaces the testing rules of the brief and of CLAUDE.md where it contradicts them)

The user's decision: speed up without losing rigour. It replaces the testing rules of the brief and of CLAUDE.md where it
contradicts them.

1. A FASTER SUITE, THE SAME TESTS (first, in its own commit):
   a) Playwright starts testing the packaged app (vite build and a static server of the result), not the development
      server. The tooth proof (tooth-plugin) keeps working on the build. Prove that nothing changed: the same number of
      tests, the same census, and the tooth proof of a feature still failing.
   b) Measure the complete suite with E2E_WORKERS=4, 6 and 8, one at a time, noting the time and the CPU peak. Adopt the
      largest value with CPU under 85% and no flaky test.
   Show the before and after: suite time, number of tests, census.

2. MAIN ONLY WITH THE COMPLETE SUITE, IN BATCHES OF 3:
   - Integrate each feature into the integration branch (created from main), with its own commit after, one command at a
     time: verify:fast, its scenarios, npm run e2e:tooth <id> and the census.
   - Every 3 integrated features (or earlier, at the end of a group), run the complete suite on integration. Green:
     fast-forward main to integration and push. Red: find out which of the 3 caused it, hand it back to its helper, and
     nothing goes to main until it is green.

3. NO WASTE:
   - A commit of spec and scenarios only: manifest:check and verify:fast; never e2e.
   - 1 or 2 tests failed: run only them (--last-failed). If they pass alone, it is flakiness: fix the cause as a pending
     item before the next batch. Do not run the whole suite again because of it.

4. THE HELPERS WRITE, YOU VERIFY: the helpers also write the spec and the scenarios of their feature (the scenarios stay
   committed before the code). You do not write contracts nor feature code; you verify, integrate and commit.

## The /goal in force (Complete audit)

Replaced by: the /goal of 2026-09-25 (last).

## The /goal in force (2026-09-25, session "Complete audit of the application"; literal; replaces the previous /goal)

Audit the whole application through the source code, identify every problem of any kind and fix everything. Do not trust
the existing tests: audit each one and rewrite the fraudulent, weak or wrong ones. Do not fake anything to pass. No skip,
weakened assertion, mock of the tested code or code that exists only for the test. Each fix needs a test that fails with
the defect and passes without it. Finish only when the application works end to end without problems, and deliver the
raw output of the tests with the list of what was fixed.

## The user's decisions (answers) · 2

Replaced by: the saving correction of 2026-09-26 (the guard change the user authorised).

2. Question about the commit blocked by the guard (it validates the main folder): "Choose whatever is best and stop
   asking". Chosen: fix the guard to validate the repository where the git command runs (the worktree), without stash
   or checkout in the main folder.

## Brief · opening line and the label of the 2026-09-25 decisions

Replaced by: done (framing lines only).

Brief: the complete application, healthy. Read to the end and answer only "ready"; wait for the /goal.

The user's decisions:

## Codex parallel work: parallel, browser for both, less waiting (2026-09-26, literal)

Replaced by: "CLAUDE: YOU GO BACK TO DOING EVERYTHING ALONE, WITHOUT CODEX" (2026-09-26). Codex left; Claude does
everything alone.

## Working in parallel with Codex (2026-09-26, literal, in force)

WORKING IN PARALLEL WITH CODEX (literal, in force; save it in .memory/builder-brief.md and summarise it in
.memory/builder.md)

Continue exactly with what you are doing (2.1). From now on Codex works in parallel, in the folder
C:\Users\jonathanrodriguesti\Documents\builder-codex, branch codex (ports 5341/5311). Coordination is through the file
C:\Users\jonathanrodriguesti\Documents\builder-coord\BOARD.md: read it whole now and at the start of each item.
1. LANES: yours is the BOARD's (2.1, A1.1, A3 of Block 1, Blocks 2–6 with the A items tied to them, Block 8, groups 13,
   14 keyboard, 15, 20 and the waiting ones). Block 7 (with the A3 tied to it), groups 19, 17 and 16, and then 9.1
   (group 18) are Codex's: do not do them. The division of lanes holds over the addendum's "order 1 to 9", by my
   decision. Write "Block 6 closed" in section 6 of the BOARD when you close Block 6 (it releases 9.1 for Codex).
2. BROWSER LOCK: before any command that opens Chrome (npm run check, e2e, e2e:tooth, e2e:diagnose, playwright, real use),
   create the folder C:\Users\jonathanrodriguesti\Documents\builder-coord\suite.lock with owner.txt (name, command, time)
   and delete it when finished, even if it fails. Taken: work without the browser and try every 2 minutes; more than 90
   minutes: note it in section 7 and take it.
3. CONTESTED FILES: reserve in section 5 of the BOARD before editing those of the list of section 3; respect Codex's
   reservations.
4. YOU ARE THE INTEGRATOR: at the end of each item of yours, read section 6. If there is a "ready to integrate <sha>" from
   Codex: git fetch origin; merge origin/codex into integration (conflicts: preserve both sides; generated files: npm run
   gen, never by hand); npm run check (with the lock); push integration; a line "integrated up to <sha>". Copy the done
   lines of Codex's checklist (C:\Users\jonathanrodriguesti\Documents\builder-codex\.memory\audit-checklist.md) into
   yours. When Codex writes "Block 7 ready for the suite" (or a phase), run the complete suite (verify:fast, then e2e,
   with the lock) on integration and write the result in section 6; a failure coming from Codex's code becomes a note to
   it in section 7. main only advances with the complete suite green, by you.
5. PROGRESS.md: the section "## Codex lane" is Codex's; do not rewrite it.
6. Codex's notes in section 7: answer them at the start of each item of yours. All the other rules stay as they are.

## Browser released for both (2026-09-26, literal, in force; replaces the single browser lock)

BROWSER RELEASED FOR BOTH (literal, in force; save it in .memory/builder-brief.md, summarise it in .memory/builder.md
and, in CODEX's case, also in AGENTS.md)

From now on CLAUDE and CODEX may use the browser AT THE SAME TIME. This order replaces the single "browser lock" of every
earlier message (BOARD section 4, CODEX's prompt, CLAUDE's parallel message and the real-use prompt). Section 4 of
C:\Users\jonathanrodriguesti\Documents\builder-coord\BOARD.md is already rewritten with these rules: read it now. Nobody
stands still or works without the browser any more because the other is testing.

1. LIGHT USE (both at the same time, without waiting for the other)
- Each agent may have at most ONE Chrome session at a time. It counts as light use:
  - headed real use in the open app (one browser);
  - npx playwright test tests/e2e/scenarios.spec.ts -g <id>;
  - npm run e2e:tooth <id>;
  - npm run check, when it does not widen to run everything.
- Run the light tests with E2E_WORKERS=2.
- Ports stay separate:
  - CLAUDE: dev 5321, e2e E2E_PORT=5310;
  - CODEX: dev 5341, e2e E2E_PORT=5311.
- MARKER: when opening Chrome, create the folder C:\Users\jonathanrodriguesti\Documents\builder-coord\browser-claude.lock
  (CLAUDE) or ...\browser-codex.lock (CODEX), with owner.txt (command and time). Delete it when closing Chrome, even if it
  fails. The marker does not block the other agent: it only says there is a Chrome of yours open.

2. HEAVY USE (exclusive, short and announced)
- Heavy is:
  - the complete suite (npm run verify:fast + npm run e2e, with the default workers), which only CLAUDE runs;
  - npm run check that announces it runs everything;
  - e2e:diagnose of more than 10 tests.
- Whoever is going to run something heavy:
  1. creates the folder C:\Users\jonathanrodriguesti\Documents\builder-coord\suite.lock with owner.txt;
  2. writes in section 7 of the BOARD "heavy in 5 min";
  3. waits for the other's marker to disappear, for at most 10 minutes, and runs;
  4. deletes suite.lock when finished, even if it fails.
- With suite.lock present, the other does not open a new Chrome: it closes the current light session as soon as it can
  (at most 10 minutes) and goes on without the browser until the folder disappears.
- A lock or marker older than 90 minutes: note it in section 7 and delete it.

3. WORKERS
Running the light tests with 2 workers is my decision, for the PC's resources, and does not serve to make a test pass. A
test that passes with 2 workers and fails with the default (or the opposite) is flakiness: record it in PROGRESS.md with
the log and the count of repetitions, and fix the cause. Never add a retry nor increase a timeout.

4. WHAT STAYS THE SAME
- Real use in the open app stays mandatory in every item or part:
  - 4 combinations: Desktop 100%, Desktop Fit, Phone 100%, Phone Fit;
  - real mouse and keyboard;
  - refusals, undo, reload, export and a console without errors;
  - evidence in .cache\logs\uso-<item>-<time>\.
- CODEX keeps delivering in parts, with "ready to integrate <sha> <item><part>".
- CLAUDE stays the integrator and the only one who runs the complete suite and advances main.

5. NOW, EACH ONE
- CODEX: if the folder suite.lock is yours (real use 7.1 baseline, since 14:58), swap it now for the marker
  browser-codex.lock, without closing what you are doing. Then follow 7.1 in parts.
- CLAUDE: you are on A3.32 with the contract defined (spec P4; a window of 1000 ms to group arrows into one undo step;
  a fine step of 0.1 for em/rem; a refusal when there is no number to adjust). You no longer need to go on without the
  browser. Do the messages and the code. Then run the scenarios of A3.32, the tooth proof and the real use in the 4
  combinations, with the marker browser-claude.lock and E2E_WORKERS=2, without waiting for Codex.
- Both: write in section 6 of the BOARD a line "read the new browser rule".

## Less waiting, more delivery (2026-09-26, literal, in force)

LESS WAITING, MORE DELIVERY (literal, in force; save it in .memory/builder-brief.md, summarise it in .memory/builder.md
and, in CODEX's case, also in AGENTS.md)

Since the two work in parallel, the total delivered fell: CLAUDE did 1 item every ~20 min alone and now does 1 every
~30 min, and CODEX delivered one part in 2 hours. The time is going into heavy checks at every item, waiting for the
other's browser, contested files and repeated merges. This order cuts that. It replaces, in the earlier messages (CODEX's
prompt, CLAUDE's parallel message, browser released, real use, delivery in parts), only what is written below. The rest
stays in force.

1. HEAVY TESTING ONLY AT THE END OF THE BLOCK (back to my order of 2026-09-25)
- The complete suite (npm run verify:fast + npm run e2e) and any npm run check that announces running everything only
  happen when a BLOCK closes: a block of CLAUDE's, or a phase or block of CODEX's. The one who runs it is CLAUDE, on
  integration.
- When closing an item, a part or an integration, the test is the light one:
  - npm run typecheck;
  - npm run lint;
  - npx vitest run with the touched files;
  - npx playwright test tests/e2e/scenarios.spec.ts -g <ids of the items involved>, with E2E_WORKERS=2;
  - npm run e2e:tooth <id> of each new or changed feature.
- If npm run check announces it will run everything, do not run it: do the light test above and record in PROGRESS that
  the complete check is left for the end of the block.
- CLAUDE: if the heavy check started at 16:14 has not started yet, do not run it; delete suite.lock and do the light
  test. If it is already running, let it finish and do not repeat it.

2. NOBODY WAITS FOR THE OTHER
- Light browser use: both at the same time, always (one Chrome session each, with the marker browser-claude.lock or
  browser-codex.lock).
- Waiting for the other's marker only exists before the end-of-block suite (suite.lock + "heavy in 5 min" in section 7 +
  at most 10 minutes). In no other case does anyone stop because of the other.

3. LESS FREQUENT INTEGRATION
- CLAUDE:
  - brings origin/codex at most once an hour, or when closing an item of yours and there is a "ready to integrate"
    pending;
  - at each integration: merge, npm run gen, the light test with the scenarios of the items that arrived, push, a line
    "integrated up to <sha>".
- CODEX: merges origin/integration only at the start of each ITEM (7.2, 7.3…), not of each part. If a conflict appears in
  the middle, resolve it only when starting the next item.

4. CONTESTED FILES
- Reserve only while editing, and release at the commit, not at the end of the item.
- When the file you need is reserved by the other:
  - do first the part of the item that does not use that file;
  - write in section 7 the exact stretch you need;
  - keep working.
  Never stand still waiting.
- The owner of the reservation releases it as soon as it finishes the stretch, even with the item in progress.

5. REAL USE IN THE BROWSER (stays mandatory, with less repetition)
- When closing each PART: that part's criterion in 2 combinations, Desktop at 100% and Phone at Fit.
- When closing the whole ITEM: the complete criterion in the 4 combinations (Desktop 100%, Desktop Fit, Phone 100%, Phone
  Fit), with refusals, undo, reload, export, a console without errors and evidence in .cache\logs\uso-<item>-<time>\.
- At the end of the block: the real use of every item of the block in the 4 combinations.

6. PACE
- CODEX: finish and deliver 7.1b now. Then 7.1c, 7.1d, 7.1e, one part at a time. In the contract and the scenarios of 7.2
  on, write only what the item asks for, without anticipating the next ones.
- CLAUDE: follow A3.38 and the remaining A3 of Block 1 (A3.10, A3.11), then Block 2.
- Both: do not stop to explain plans nor to ask. In the chat, only one line per item or part delivered: item, commit,
  what started working.

7. MEASUREMENT
At 18:00, CLAUDE writes in section 6 of the BOARD how many items and parts the two delivered since 16:30 (commits on
origin/integration and origin/codex). I decide with that number whether the parallel work continues.

Now: both write in section 6 of the BOARD a line "read the less-waiting order" and go on.
