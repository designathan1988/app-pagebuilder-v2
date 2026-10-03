# The archive

Superseded documents, kept whole so nothing written about the product is lost. None of them is in force: the product's
single source is [`docs/PRODUCT.md`](../PRODUCT.md) (decision DEC-36), the behaviour is
[`spec/BEHAVIOUR.md`](../../spec/BEHAVIOUR.md), the state of each feature is generated in
[`docs/FEATURES.md`](../FEATURES.md), and the history is [`docs/QA-LOG.md`](../QA-LOG.md). Each file here begins with a line
saying where it came from and where its content went. Archived on 2026-10-02 by the final audit
([`docs/AUDIT-2026-10-02.md`](../AUDIT-2026-10-02.md)), except where a row says otherwise.

## Old → new

| Old place | Archived as | Where its content lives now |
|---|---|---|
| `docs/PROJECT.md` (versioned; "the one project document" since `2b93e68`) | [`PROJECT.md`](PROJECT.md) | Layers, document rules, interface → PRODUCT.md 5.1–5.3; the loop, the two runners, `e2e:affected`, budgets, adding a feature, the perf protocol → section 6; the state of 2026-10-01 → sections 2 and `FEATURES.md`; its decisions → DEC-02, DEC-24–DEC-26; the rules never broken → `CLAUDE.md` and sections 6–7 |
| `docs/STATUS.md` (versioned; the status board of 2026-10-01) | [`STATUS.md`](STATUS.md) | What it is → section 1; architecture → 5.1; delivered → section 2 and `FEATURES.md`; proof → section 6; stability and the dogfooding pass → `QA-LOG.md`, section 2.3; open items → section 3 (T7) and section 4 (DEC-01, DEC-24–DEC-29, DEC-34); Jornada 03 stage 1 → STG-1.* |
| `jornada03/PAIRING-2.md` (versioned; stage 5's manual pairing record) | [`PAIRING-2.md`](PAIRING-2.md) | STG-5.20 (partial, AUD-28); the surface rows → STG-5.*; the four kept on purpose → DEC-20–DEC-23 |
| `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PROGRESS.md` (deleted by `2b93e68`, 2026-09-29) | [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DESIGN.md`](DESIGN.md), [`PROGRESS.md`](PROGRESS.md) | Folded into `PROJECT.md` by `2b93e68`, now PRODUCT.md section 5. Restored because 326 code comments still cite them by name (AUD-30); a comment citing `ARCHITECTURE.md §n` or `DESIGN.md §n` resolves here |
| `.memory/plan.md` (not versioned; Portuguese; the approved plan of 2026-10-01) | [`plan-2026-10-01.md`](plan-2026-10-01.md), translated | Its twelve requests → PLAN-R1–R12; its stages and items → STG-0.1 … STG-17; its decisions taken at the maximum → DEC-02, DEC-04–DEC-07; its glossary → section 8 |
| `.memory/layout-composer-spec.md` (not versioned; Portuguese; the user's concept of 2026-10-01) | [`layout-composer-concept.md`](layout-composer-concept.md), translated | `spec/BEHAVIOUR.md#layout-composer` and the manifest, which win on conflict (DEC-16, DEC-17); stage 11 → STG-11.* |
| `.memory/builder-brief.md` (not versioned; the /goal of 2026-09-28 and the standing orders) | [`history/builder-brief-2026-09-28.md`](history/builder-brief-2026-09-28.md), quotes translated | REQ-U01–REQ-U09 |
| `.memory/codex-prompt.md` (not versioned; Portuguese; the first Codex prompt, 2026-10-01) | [`history/codex-prompt-2026-10-01.md`](history/codex-prompt-2026-10-01.md), translated | DEC-12; `AGENTS.md` |
| `.memory/archive/builder-brief-old.md` (not versioned; orders of 2026-09-25/26 a later one replaced) | [`history/builder-brief-2026-09-25.md`](history/builder-brief-2026-09-25.md), translated | History only; each section names what replaced it |
| `.memory/archive/builder-brief-earlier.md` (not versioned; the briefs up to 2026-09-24) | [`history/builder-brief-2026-09-24.md`](history/builder-brief-2026-09-24.md), translated | History only |
| `.memory/archive/auditor-brief.md`, `.memory/archive/auditor.md` (not versioned; the auditor session of 2026-09-24) | [`history/auditor-brief-2026-09-24.md`](history/auditor-brief-2026-09-24.md) (translated), [`history/auditor-state-2026-09-24.md`](history/auditor-state-2026-09-24.md) | History only |
| `.memory/archive/gpt-handoff.md` (not versioned; a work order for another model, 2026-09-29) | [`history/gpt-handoff-2026-09-29.md`](history/gpt-handoff-2026-09-29.md) | History only |
| `.memory/audit-checklist.md` (not versioned; the real-use audit checklist of 2026-09-26) | [`history/audit-checklist-2026-09-26.md`](history/audit-checklist-2026-09-26.md), translated | History only; its open items were carried into the plan of 2026-10-01 |
| `.memory/panel-audit.md` (not versioned; the Style panel's static audit, 2026-09-29) | [`history/panel-audit-2026-09-29.md`](history/panel-audit-2026-09-29.md) | History only |
| `.memory/coordination.md`, `.memory/builder-b.md` (not versioned; the parallel conversations of 2026-10-01) | [`history/coordination.md`](history/coordination.md), [`history/conversation-b-closed-2026-10-01.md`](history/conversation-b-closed-2026-10-01.md) | DEC-11 |
| `.memory/module-ownership.md` (not versioned; review item R5) | [`history/module-ownership.md`](history/module-ownership.md) | DEC-32 |
| `.memory/review.md` (not versioned; the reviewer's findings for Codex) | [`history/review-2026-10-02.md`](history/review-2026-10-02.md), a snapshot | R4 → section 3 and DEC-10; the live file stays in `.memory/` because `AGENTS.md` names it |

What stays outside the archive: `.memory/builder.md` (the short session memory) and `.memory/review.md` (the live
review file), both ignored by git; `jornada03/` (the study's evidence, `REPORT.md` and its data, unchanged).

The other documents `2b93e68` deleted (`docs/history.md`, `docs/testing/README.md`, `docs/audits/*`, the earlier
`docs/archive/`) were folded into `PROJECT.md` then and are not cited by any code; they remain in the history at
`git show 2b93e68^:<path>`.

## The check that every id made it

`node .cache/scratch/audit/check-ids.mjs` (a throwaway script of the audit) reads the old documents — the plan, the
status board, the project document, the pairing record, the briefs, `jornada03/REPORT.md` and the QA log's open items —
collects every id they define (J*, H*, M*, D*, C*, P*, the bets A–F, the wishes, the stages and their items, R*, T*,
the decisions), and fails if one is missing from `docs/PRODUCT.md`. Its result at the archiving commit is in
`docs/QA-LOG.md` row 148.
