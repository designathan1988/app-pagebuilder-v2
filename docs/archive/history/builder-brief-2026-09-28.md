Archived 2026-10-02 from `.memory/builder-brief.md` (not versioned), the user's quotes translated from Portuguese. The
orders below are rows REQ-U01 to REQ-U09 of the requirements register in `docs/PRODUCT.md` section 2.1, where their
status is kept.

# Builder brief in force

Only the orders in force, literal. Where two contradict, the more recent holds, and the user's most recent message in
the chat holds above everything.

## The /goal in force (2026-09-28, literal, translated; the consolidation and builder-6)

"Before building `builder-6`, do one single definitive consolidation of all the existing work. Audit quickly ALL the
branches, worktrees, uncommitted changes, files outside the integration and parallel implementations existing in the
project. For each, determine only: is there functional code or a real improvement that is not yet in the main
application? is it better/correct and should it enter? is it duplicated, incomplete, abandoned or useless?
Everything that is good must be integrated immediately. Everything that does not serve must be discarded. Leave
absolutely no useful feature forgotten in a branch, worktree, stash, parallel folder or agent tree.
After this consolidation, end once and for all the fragmented development model: no worktrees; no agent branches; no
artificial division of tasks into parallel trees; no code waiting for future integration; no multiple copies of the
application; no systems that prevent modifying the application directly; no hooks, guards, checkpoints, impact
machinery or bureaucratic automations that block operations without concrete benefit.
I want one single working tree, directly at the root of `builder-6`, containing the real and current state of the
application. If the project's Git/GitHub infrastructure is imposing blocks, hooks, policies or mechanisms that get in
the way of this way of working, remove those mechanisms from `builder-6`. After rescuing all existing useful code, do
not preserve worktrees, auxiliary branches, hooks or historical infrastructure just as a precaution. Do not destroy
useful work before verifying it. First audit and incorporate what is good; then eliminate the structure that kept it
separate. From there, build `builder-6` as a consolidated application, not as one more branch of the old architecture.
Desired organisation: one single root; one single current implementation of each feature; no parallel project; no
dead code or abandoned implementation; no feature split between branches or waiting for a merge; clearly locatable
modules; each feature concentrated in the smallest reasonable number of files; interface, behaviour and styles specific
to a module together whenever possible; sharing only what is genuinely common; no CSS, logic or state scattered
arbitrarily; no abstractions and directories created only for theoretical 'organisation'; no redundant documentation.
Modularity here means independence and clear location, not spreading a feature over ten files. Whenever a feature can be
understood and maintained cleanly in a single main file, do that. Only split when there is a concrete technical reason.
Do this using directly the audit you have just finished. Do not do another endless round of analysis, do not write
another plan and do not turn the consolidation into a separate project.
Mandatory sequence: 1. locate all work still separate; 2. evaluate quickly what is really good; 3. integrate everything
that must exist in the product; 4. eliminate duplicates, residues and bad implementations; 5. remove worktrees,
auxiliary branches, hooks and unnecessary bureaucratic infrastructure; 6. create/consolidate `builder-6`; 7. reorganise
and refactor the code during the migration; 8. finish with one single functional and organised application at the root
of `builder-6`.
Do not leave 'to integrate later'. Do not keep parallel systems 'for safety'. Do not create new branches/worktrees to do
this. Do not preserve bureaucracy because it already exists. Take everything that is correct, incorporate it now,
remove the rest definitively and leave one single clean, simple and functional base."

## Standing orders in force (the user's orders still standing)

1. "The tests must be done at the end of each block, and about what was implemented and not about everything. The
   complete test suite is for when everything has been implemented and everything is ready, not at every block or
   task!"
2. "You do have to do the basic test for everything and in the browser too... I do not want a heavy test at every
   stage, I do not want redundant tests, but the basic test of that feature has to exist."
3. "The verification in the browser is ALWAYS with Playwright on the installed Chrome (channel: 'chrome')" — never with
   the embedded preview pane, which does not press keys with modifiers, does not drag and does not read what the app
   stored. Each real gesture (click, drag, typing), one photo per step in `.cache/logs/uso-<item>-<time>/`, compared with
   what the code must produce.
4. "DO NOT DEFRAUD TESTS TO PASS, BECAUSE THE TESTS WERE CREATED TO TEST THE OBJECTIVE THEY ARE MEANT FOR." Never edit,
   skip or loosen a test or scenario to pass; if one looks wrong, stop and say why.
5. "Implement all the features of the application... the application with all the features implemented, working
   correctly end to end, without errors, without deviations, without frauds."
6. Everything in English: specs, manifest, DESIGN, ARCHITECTURE, PROGRESS, scenarios, commits, comments and names.
   Portuguese only in the reports to the user in the chat.
7. The Pager (`reference/`, in the old checkout `../builder-5/reference/`) is the reference for behaviour, never for
   code; where it contradicts our contract, our contract holds.
8. Do not stop between items or between blocks and do not ask: decide by what has already been decided and record it in
   docs/PROGRESS.md. Show in the chat what each item changes, what the photo showed and the commit.
