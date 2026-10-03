Archived 2026-10-02 from `.memory/archive/auditor.md` (not versioned): the auditor session's state on 2026-09-24. History only.

# Auditor state (rewritten whole at every update; read with auditor-brief.md before any action)

Updated: 2026-09-24, after 094eec8 and the user's change of pace (brief section 14).

## Pace (user 14, corrected by 15) — overrides older habits where they conflict
- 15.1: FULL method (worktree run, tooth, app, search outside the diff) on EVERY commit touching manifest/, src/, tokens, i18n, tests or config. Quick review (read) ONLY for commits touching exclusively .md documentation files.
- 15.2: BLOCKINGs are sent AT ONCE, always, one by one. Only NOTEs go together at the end of each numbered builder item.
- 15.3: every behaviour the builder delivers needs a browser test that fails when it is switched off, even with no scenario covering it; behaviour without one is BLOCKING. Review every decision the builder records in PROGRESS.md for a small ambiguity; if it changes what the user sees or does in the editor, tell the user in Portuguese with a ready-to-paste message.
- BLOCKING = a violation of a rule in CLAUDE.md, DESIGN.md, ARCHITECTURE.md or the brief (including 15.3). Improvements and preferences are NOTEs.
- Do not take to the user what CLAUDE.md, DESIGN.md, the manifest or earlier decisions already answer: decide, record here, go on. Only product decisions go to the user.
- Do not widen the builder's scope: no asking for tests, rules or checks beyond what the brief and the scenarios require.
- The builder fixes BLOCKINGs at the end of each numbered item, not mid-item. That is not disobedience.
- Scenarios only when no commit waits for review.

## My errors (never again)
1-6: red scenario commits; verify:fast in the shared folder; sent the builder orders; scenarios before verification; my own scripts; wrong regex. 7: single-source error at a92d782 (corrected; user approved my fix, 13.1). 8: stale dev server — after every checkout restart 5400 (kill the PID after checking it is .cache\audit vite; start (PORT=5400 nohup npm run dev > /dev/null 2>&1 &)) and curl the changed file. 9: left a builder question unanswered (380745b). 10: stated a grep result before running it. 11: proposed an undo/redo exception already decided otherwise.

## Standing rules (user)
- No script files for me; commands one at a time with output; only temporary tooth edits in .cache/audit, undone right after.
- No finding from one search: confirm by a second means; correct wrong statements at once.
- Rules A-E (brief 10): verification first; shared folder read only (only git commit --only on manifest/features after D); run in .cache/audit (checkout --detach, PORT=5400, E2E_PORT=5401); to the builder only reviews/notices.
- e2e in worktree: sed -i "s#'\*\*/.cache/\*\*', ##" playwright.config.ts, run, git checkout -- playwright.config.ts.
- Undo/redo: census accepts history-doors.spec ("Prove unavailable") until a built undoable command; group 02 scenarios must run undo/redo through every door.
- Builder script rule (13.4): scripts only read/print, in .cache/scratch/, never committed; no file edits by regex; bulk JSON only as objects, count first, git diff --stat after. Violation = BLOCKING.

## Watch items
- 13.1: builder's next commit restores the Timeline body (18 disabled dock-timeline doors) and the Styles view (variables doors, disabled), re-enables their opening doors, keeps Checks and Keyboard shortcuts disabled. Full method (it changes the screen).
- 13.3: satisfied — 094eec8 fixed the 7cb737c BLOCKING before item 2.

## Sessions
- Builder "Constructor"; SendMessage to "Constructor". Commit watcher Monitor (re-arm on expiry, 30 min).
- Old scratchpad verify-copy has a node_modules JUNCTION: remove only with cmd //c rmdir.

## Open BLOCKINGs
- none (after 5ec8390).

## Part 1 closed (2026-09-24, at 5ec8390, pushed)
- 5ec8390 OK (13.1 done): 274/38 on clean worktree; census 31 states, 362 doors, 24 enabled; Chrome Timeline 18 disabled doors, Styles New variable disabled. End-of-item NOTE batch + my OF 2/3/4/8 decisions sent.
- 1440 shell vs design/final/shots/1440-01-default.png: structure matches; differences are unbuilt features only (renderer = part 2, no selection, no save state).
- OF 10 DECIDED by the user (brief 16): a View menu item toggling a dock panel shows it when not visible and hides it only when visible (fresh profile: View › Timeline opens the dock on Timeline). Applies to every dock panel toggled from View. Builder does it AFTER the current item, separate commit, push, notice with raw output. When it lands check: a browser test through View › Timeline that fails if the first click removes the tab; tooth proof; same behaviour for View › Checks once it has a body (today disabled) and View › Workbench semantics unchanged; panels/waiting-panels specs updated (waiting-panels.spec:32 today pins the old two-click behaviour).
- Builder now on item 2 (foundation part 2) with two helper agents the user allowed (coordinates; iframe renderer). Uncommitted work touches ARCHITECTURE.md, project.json, references.json, package.json.

## NOTEs held for the end of the current numbered item (send together, after the 13.1 commit is reviewed)
- My decisions (14.3) on PROGRESS open findings the builder left "for the user":
  - OF 8 (unbuilt toggle/radio says aria-pressed/aria-checked "false"): keep. "false" states no current state: an unbuilt feature's state is off (zoom 100 is not the chosen level, outlines are not shown); ARCHITECTURE "Door rendering" forbids standing FOR the current state, which "false" does not. Close it.
  - OF 2 (display flow; justify-items/self baseline, self-start, self-end, flex-start, flex-end): keep all offered. The exclusion list is for values no browser acts on; these act (display flow = block flow; justify-* act in grid and absolute layout). Close it.
  - OF 3 (no Chrome test for undo/redo/setWorkbenchState): stale. workspace-doors.spec runs the strip toggle/maximize; history-doors.spec + census cover undo/redo per the user's "Prove unavailable". Close it.
  - OF 4 (Styles view shows only headings): rests on MY wrong a92d782 statement (already corrected). Close it.
- Checked: DESIGN.md Build order (Pages and Files drawn from the start, doors disabled, 2fc025f) = what CLAUDE.md requires; nothing for the user.

## Reviews (latest first)
- 094eec8 OK: census visits 28 states; 274/34 (1.5m); my tooth (palette.toggleGroup#elements-group-header enabled) fails right; his Insert-tile tooth too.
- 7cb737c FINDINGS (fixed by 094eec8). 54812c1 OK (effd579 BLOCKINGs 1-5 all fixed). 33cb83d OK. 46c8805 FINDINGS 2 NOTEs. 65cc75a FINDINGS (fixed). 6bd18df OK. bc8351e OK. 896f2fd OK. c30a87a, b1fe2ec, f1c41fc, e8cb83f FINDINGS all fixed since. Re-audit of part 1 done.

## Part-1 goal final check (after 13.1 is reviewed with no BLOCKING)
- verify:fast + e2e myself on a clean tree, compare; part-1 items one by one; 1440 screenshot vs design/final/shots/1440-01-default.png; short summary to the user in Portuguese + the visual-pass brief/goal ready to paste.

## Decisions
- User: all properties = browser values + presets; raw tail with every commit; icons before item 5; exclusion list + dark default in item 1; one run; shared-folder git rules; memory; rules A-E; zoom "fit" | zoomLevels; 13.1-13.4; pace 14.
- Mine (minor): dark default keeps Light/Dark/System; fixtures only through File > Open; scenarios follow DESIGN.md.

## Scenarios
- Committed: d68b8be, d747ff0, ea0f2bb (group 02: 127), 38922ae (group 01: 5), 6f58f23 (zoom "fit").
- Group 03 scenarios: only when no commit waits (rule A / 14.6).
