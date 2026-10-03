Archived 2026-10-02 from `.memory/codex-prompt.md` (not versioned), translated from Portuguese: the first prompt given
to Codex when the work was handed over on 2026-10-01 (`docs/PRODUCT.md` DEC-12). Its goal is now the requirements
register of `docs/PRODUCT.md`; `AGENTS.md` is the current entry for Codex.

You will continue the development of the Builder (a page builder for professionals) in this folder,
`C:\Codex-Shared\deepseek\builder-6`. Another agent (Claude) started the work; now it is yours.

1. Read the root's `AGENTS.md` and EVERYTHING it tells you to read, in order: the whole `CLAUDE.md`, `.memory/builder.md`,
   `.memory/plan.md` (the approved plan of 18 stages, it is the mission), `.memory/review.md` and `docs/QA-LOG.md`.
2. Before changing anything, answer in Portuguese with: (a) a summary of the rules you will follow (how you commit and
   push, the cycle of each item, what you can never do with tests, the role of `.memory/review.md`); (b) where the work
   stands and what the next item is; (c) the output of `git status --short` and `git log --oneline -3`.
3. Run `npm run check:fast` (complete output in `.cache/logs/`) and say whether it is green. In the folder there is
   uncommitted work, described file by file in the memory: J2 (letters outside a field firing shortcuts) ready, tests
   passing; J4 (space disappearing when editing a button's text) and J7 (Ctrl+Z after Enter in a field) with code written
   and the browser test still failing. The three share keymap.ts, the languages and the spec: separate them into one
   commit each.
4. Then work without stopping, in the plan's order: the J2 commit; finish J4 and J7; the rest of stage 1 (J8, J23, J15a,
   J3); the stage 0 that remained (0.2 tests that fail first, 0.3 the task meter, 0.4 parity with the canonical, 0.5
   performance); and then stages 2 to 17, each feature complete, never the minimal version.
5. One commit per change, always through the gate (Git Bash by its full path, as `AGENTS.md` says), with a push to the v2
   repository, a QA-LOG row and the memory rewritten after each commit.
6. Before each new item, read `.memory/review.md`: whatever is `OPEN` comes first.
7. Messages to me in plain Portuguese, with every acronym and every code (J1, H11, e2e, p95…) explained.
