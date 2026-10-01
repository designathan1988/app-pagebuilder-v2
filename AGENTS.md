# AGENTS.md — the entry for Codex

You are continuing work another agent (Claude) started in this repository. Everything that governs the work is
already written down; this file tells you where, and adds only what is specific to you.

## 1. Read, in this order, before anything else (and again after any context compaction)

1. **`CLAUDE.md`** — the rules of this repository, whole. They apply to you exactly as written: wherever it says
   "the assistant", it means you. Nothing below relaxes any of them.
2. **`.memory/builder.md`** — the working memory: where the work stands, what to do next. Rewrite it whole (at most
   60 lines) after every commit, so it always says what to do next.
3. **`.memory/plan.md`** — the approved plan (18 stages, in Portuguese). It is the mission in force. Follow it in
   order; do not reorder, shrink or skip stages.
4. **`.memory/review.md`** — the reviewer's findings on your work (see section 5). Read it before every new item.
5. **`docs/QA-LOG.md`** — every change so far, one row each, with its commit.

`.memory/` and `.cache/` are ignored by git and exist only on this machine. `.memory/archive/` holds old briefs that
no longer apply (in particular the old restricted "work order" for GPT): ignore it. The other files in `.memory/`
(`builder-brief.md`, `audit-checklist.md`, `panel-audit.md`) are older background; where anything contradicts
`.memory/plan.md`, the plan holds (it is the user's most recent order, 2026-10-01).

## 2. The mission

Carry out `.memory/plan.md` to the end: every finding of the Jornada 03 usability study (J1–J28, H1–H17) fixed and
proven, and every new capability of stages 2–17 built **complete** — never a stub, a placeholder, a TODO or "a first
version". Work continuously from one item to the next without stopping to report or to ask; the user reviews
through the reviewer (section 5). Stop only for something that needs the user's own credentials or permission
(JDK/Android SDK install, Apple account, GitHub/Netlify token, Anthropic key, signing certificate): build the field
or the step for the user, never type a credential, write it in `.memory/builder.md` under "Waiting on the user", and
continue with the next item that does not depend on it.

## 3. The cycle of one item (one change = one commit)

1. Read `.memory/review.md`; any `OPEN` finding comes first.
2. Write the test that reproduces the problem or proves the new behaviour, and see it **fail**.
3. Change the manifest (`manifest/`) and `spec/BEHAVIOUR.md` first when behaviour changes, then the code, in the same
   commit. One owner per concept (the inventory names it); never a second implementation.
4. `npm run check:fast` (log to `.cache/logs/`).
5. Interface changes: `npm run ui -- <flow>` (real gestures in the installed Chrome, a photo per step into
   `.cache/logs/ui-<flow>-<time>/`). Open the photos and look at them; compare with the canonical layout
   `design/final/index.html` where the plan asks for parity. The Codex browser and the `pagebuilder-user-testing`
   skill may help you look, but the proof is `npm run ui` and the e2e tests.
6. `npm run e2e:affected` (the browser tests the change reaches).
7. A row in `docs/QA-LOG.md` (what the person met, what changed; the commit column says `(this commit)` and is filled
   with the hash right after).
8. Commit through **the gate** (section 4). Then rewrite `.memory/builder.md`.

At the end of each stage: the e2e tests of what the stage built (`npm run e2e -- <specs>`), the photos compared, and
a short stage summary in `.memory/builder.md`. The complete suite (`npm run e2e`, about 13 minutes) runs at the end
of stages 5, 11 and 17.

Never edit, skip or loosen a test or a scenario to make it pass. A scenario changed on purpose goes in the same
commit, with its spec line and the reason in the QA-LOG row. Never fake a result; the complete output of every
command you rely on goes to `.cache/logs/`.

## 4. Commit and push: the gate (Windows specifics)

The gate regenerates, runs `check:fast`, commits and pushes `main` to `origin`
(github.com/designathan1988/app-pagebuilder-v2; the remote `v1` is the old repository, read-only). It is the only way
to commit:

```powershell
& "C:\Program Files\Git\bin\bash.exe" .cache/scratch/gate.sh .cache/scratch/msg.txt <short-tag>
```

- Use **Git Bash** by that full path. Never plain `bash` from PowerShell: on this machine it resolves to
  `C:\Windows\System32\bash.exe`, which is WSL, not Git Bash.
- Write the message file `.cache/scratch/msg.txt` with your file-editing tool, not with PowerShell redirection
  (Windows PowerShell 5.1 writes a byte-order mark or the ANSI code page). English, one subject line in the
  imperative, a blank line, a short body. No `Co-Authored-By: Claude` line.
- If the gate prints `GATE FAILED`, read `.cache/logs/check-fast-<tag>.txt`, fix the cause, run it again. Never
  `--no-verify`, never `--amend`, never a branch, never a force push.
- After the commit, put its hash in the QA-LOG row; that edit rides in the next commit.

## 5. The reviewer and `.memory/review.md`

A reviewer (Claude, in another window) reads your commits, logs, photos and code and writes findings into
`.memory/review.md`, each one marked `OPEN` with where, what is wrong and what to do. Before every new item:

- fix every `OPEN` finding first (each fix is a normal item: test, change, commit);
- then change its mark to `FIXED <hash>`, or to `DISPUTED: <why>` if you are certain it is wrong (never silently);
- never delete a finding.

## 6. House rules that are easy to miss

- One agent in this tree at a time; never two Playwright runs at once.
- Lint traps: no `onPointer*`/`onMouse*` props or pointer listeners outside `src/editor/input/pointer.ts` (publish a
  signal from `pointer/views.ts`); no `contentWindow` outside the canvas; no `setState` inside an effect; CSS values
  only from the tokens; `npm run typecheck` after type changes.
- A feature with no command needs a scenario **and** a `toothProof` to be registered.
- Code, comments, docs and commit messages in English. UI text only through `src/i18n/locales/en.json` and
  `pt-BR.json`.
- Messages to the user: Portuguese, plain words, and every acronym or code spelled out the first time (J1, H11,
  e2e, p95, SUS, CI…).
- The old application at `../builder-5/reference/` is read-only reference for behaviour, never for code.
