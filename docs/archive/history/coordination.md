Archived 2026-10-02 from `.memory/coordination.md` (not versioned): the coordination file of the parallel conversations of 2026-10-01 (A the integration owner, B and the helpers); the user closed the parallel work the same day (`docs/PRODUCT.md` DEC-11). History only.

# Builder conversation coordination

## A — integration owner (only conversation A edits this section)

### Current execution rule — supersedes the former A/B parallel split

- **Latest override: SOLO execution.** The user revoked all delegation after the one-agent limit. A must not spawn, resume or assign subagents. Forms/layout are completed and motion is interrupted; none is running. All remaining candidate work and integrations now belong to A directly. The earlier one-agent allowance below is historical and no longer applies.

- A alone edits `src/`, `manifest/`, `spec/`, shared repository tests, the gate and Git; A alone runs Chrome, integrates modules and commits/pushes through the gate.
- The user now permits at most ONE subagent. Current agents finish only their in-flight chunk, with tests and an honest integration guide, then stop. Forms/publishing has finished; motion and layout received the checkpoint-only instruction. Layout is the chosen sole optional support after handoff; no other agent gets new work.
- B is closing. A takes all remaining stages sequentially, prioritizing ready packages; incomplete packages return to A's queue. No new task is assigned to B. Preserve its final checkpoint section and wait for an in-flight checkpoint to freeze before writing that candidate.
- The former transfer of capture/assistant to B is historical; final packages return to A without a second implementation. A retains all shared-source, integration, browser and commit ownership.
- Each conversation writes only its own section after this file's creation. B records build states and integration responses in section B. A maintains the consolidated folder table here, mirrors B's readiness notices, and marks a module integrated only after source/manifest/spec integration, relevant Chrome proof and a gate commit/push.
- The existing assistant correction is part of B's current closing chunk; further corrections belong to A. Every package retains `INTEGRATION.md`, tests and logs. Candidate readiness is never a claim that the feature is delivered in the app.
- The table covers every currently existing direct child of `.cache/scratch/modules/`. B records any new folder in its section; A adds it to this table. No other conversation may write into a folder with another owner.

### Folder board

| Folder | Owner | State | Observations |
|---|---|---|---|
| `assistant/` | A | construindo | Earlier readiness withdrawn: B finishes current actual-store grouping/mutation-lease correction before freezing. A already has uncommitted protocol/canvas/dependency integration; no shared wiring or Chrome claim yet. |
| `capture/` | A | pronto para integrar | B closing checkpoint:22 Node tests repeated by parent, package/current-source types/lint/extension syntax clean, updated integration/prepare. No browser corpus result claimed. |
| `content-data/` | A | construindo | Incomplete, queued for main:26 tests/type/lint pass; real controls, manifest/scenarios, store derivation, pointer binding/localization and Chrome remain. |
| `export-clean/` | A | pronto para integrar | B closing checkpoint:18 tests including mirrored export/html validation; strict package/app overlay types and lint. Frozen candidate preserves forms.js ownership. |
| `forms/` | A | integrado | Commit341ff3b pushed/remote verified. 54 focused unit,74control+2state+2runtimeChrome tests;19presets typed/validated/submitted in preview/export. Gate1853pass/54preexisting skipped. Photos shown. Integrated source contains fixes not mirrored back to candidate. |
| `forms-proof/` | A | integrado | 73 scenarios/14 fixtures copied and proven in the real app, commit341ff3b. All77doors covered; no old scenario weakened. |
| `layout/` | A | construindo | Core52 tests/type/lint; sole chosen subagent is checkpointing current integration handlers/schema/actual-store overlay. Previously written pointer mirrors unconnected; no new controller/panel work until next main decision. |
| `motion/` | A | construindo | Core32 tests/types; agent finishes only current model/command/store integration chunk and stops. Main then completes and integrates; existing command/runtime owners preserved. |
| `onboarding/` | A | construindo | Incomplete, queued:5 tests/types/lint/42 HTML previews pass; actual-store/manifest/guide persistence and Chrome thumbnails/visual acceptance remain. |
| `production/` | A | construindo | Incomplete, queued:7 utility tests/types/lint pass; app patches, real splitting, contracts/docs/security and CI/Chrome proof remain. ZIP inflate bound and preview relay issues are explicitly open. |
| `project-breakpoints/` | A | construindo | Checkpoint INTEGRATION.md + mirror-files.json lists 51 targets/hashes; 6 focused tests pass. Not safe to apply wholesale: scenarios/spec, confirmation keys, forms/driver adaptation, GridSettings type, dynamic-ID checker and fixture factories still need work. A retains this folder; responsive-frames not started. |
| `publish/` | A | pronto para integrar | Agent final:43 tests/types, executable offline modules and encrypted signing backup proofs, DELIVERY.json and updated INTEGRATION.md. No Chrome/Edge/native build/install/deployment claim. Agent stopped. |

### Transfer checkpoints

- **Capture, 2026-10-01:** files include network/assets/model/snapshot-dom/normalize/pipeline/bundle/companion/client/tab/presentation, CSS and locales, plus `extension/` manifest/popup/worker/locales. The URL pipeline uses installed Chrome when invoked, CDP snapshots/resources, pinned public DNS, redirect preservation, canvas images and an importable file bundle. `captureHandler` plugs into assistant bridge `onRequest` at `/capture/url` and `/capture/tab`; `cssUrls` must use existing `fileUrlsIn`, and `acceptTabCapture(bundle)` connects authenticated tab capture to import. Latest lint/types passed after additions. Rerun tests and extension syntax check; update stale integration instructions. No Chrome was run.
- **Capture remaining work, 2026-10-01:** negative client/route/cancellation/tab tests; actual CDP slot/shadow/input-state fidelity; bundle path deduplication; custom-element hosts normalized without losing styles; external CSS/import rewriting through the existing owner; localized worker failures and capture-limit warnings; forward reference screenshots from extension acceptTabCapture. DOM variation and import/breakpoint transactions are documented host boundaries, not a second document model. Fidelity has not been claimed.
- **Assistant, 2026-10-01:** agent confirmed it stopped writing. Detailed INTEGRATION.md and 9 passing tests/type checks are present. No real provider/key/service was used. B must keep one Companion server/transport, with capture and publishing as handlers.
- **Clean export, 2026-10-01:** A's forms/publish agent confirms it wrote no stage-6 code; no `clean-export/` folder or code checkpoint exists to transfer.
- **Retired candidates:** old `animation/` and `layout-composer/` live outside active modules at `.cache/scratch/retired-module-candidates/r5/`. Never integrate them alongside `motion/` and `layout/`; R5 is fixed in `b662713`.

### Requests from A to B

- **Assistant integration correction, 2026-10-01:** `prepare.mjs` currently makes `beginAssistantGroup` call `store.gesture()`. The real store deliberately throws for `history.transaction: per-dispatch` commands inside a pointer gesture (`src/core/store/store.ts`, run guard); element.setAttribute uses that contract (element.insert and style.set are per-gesture). Thus the candidate cannot yet group ordinary assistant attribute edits. Please prepare a source-aware correction and actual-store proof under assistant/: a distinct command-group primitive owned by the existing store (or a compatible existing primitive), one undo entry on commit and atomic document/history/selection rollback on cancel/failure. Preserve the pointer-gesture refusal and all existing sequence/gesture tests. Also specify the real busy lease that refuses unrelated document/load/history/external MCP mutations while allowing assistant transcript/status/cancel UI. Do not edit shared source. Reproduce this incompatibility against current src before fixing; the fake EditorPort tests alone do not prove grouping.

- **2026-10-01, assistant integration:** A is taking the ready assistant next. Keep the published package stable while A integrates; report any further required correction in section B first. Forms commit341ff3b added `SiteScripts.forms()` through store/handler context and export/preview/code-panel calls; export-clean patches must preserve these current-source changes and generated `js/forms.js` ownership.

- **Handoff:** inspect the transferred `capture/` and `assistant/` code and current logs, repair/update their integration instructions, and report readiness in section B. Do not discard completed work or start alternate owners.
- **New stages:** reserve distinct folders for stages 6, 8, 15 and 16; record their exact paths and ownership below before writing. No changes to A-owned candidate folders or shared app files.

## B — module builder (conversation closed)

**Conversation B was closed at the user's explicit request on 2026-10-01. All three subagents finished their current checkpoints and stopped. No further work is authorized in B. All incomplete packages return to conversation A.**

| Folder | Stage | Final state | Evidence and remaining work |
|---|---|---|---|
| `export-clean/` | 6 | pronto para integrar | 18 passing tests, including actual mirrored export and HTML validation; strict package/full-app overlay types and actual lint clean. Current-source patches preserve forms.js and capture styles. A owns integration, size/fidelity measurement and Chrome. |
| `content-data/` | 8 | incompleto | 26 passing tests; package/full-source overlay types and actual lint clean. Domain code and pageFromTree preserved. Missing executable manifest/scenarios, real UI controls, store derivation wiring, pointer binding, contextual diagnostics and Chrome. See INTEGRATION.md. Returned to A. |
| `capture/` | 12 | pronto para integrar | 22 passing tests, also independently repeated by B parent; strict package/current-source overlay types, lint and extension syntax clean. Capture/extension/assets/residual styles and corpus comparator delivered. A must integrate and prove 98% across corpus; no browser/fidelity result claimed. |
| `assistant/` | 14 | pronto para integrar | A's grouping correction completed: 25 passing tests including 7 actual-store cases; package/full-app overlay types and lint clean. Store-owned commandGroup and mutation lease replace the incompatible pointer gesture. A must wire reserve before asynchronous work and complete app/manifest/Chrome integration. |
| `onboarding/` | 15 | incompleto | 5 passing tests; package types/lint, patch preparation and 42 template HTML renderings pass. Seven page/fourteen section templates, assets, surfaces and guide preserved. Missing composed app-overlay/store proof, complete controls/contracts/guide persistence, PNG generation/build placement and Chrome. Returned to A. |
| `production/` | 16 | incompleto | 7 passing utility tests, package types/lint clean. Policy, diagnostics, lazy-panel and bundle utilities plus candidate workflows preserved. Missing source-aware patches/app wiring, actual bundle split, contracts/docs, security completion, workflow execution and Chrome. Returned to A. |

### Final handoff notes
- Each owned folder has INTEGRATION.md identifying completed work, exact checks and remaining integration requirements. Logs remain inside their packages; A preserves canonical evidence during integration.
- Assistant correction: prepare.mjs now supplies commandGroup/commandGroupOpen in the existing store and autosave/preferences guards. The pointer-gesture refusal remains unchanged. INTEGRATION.md supersedes the earlier pointer-based advice; obsolete pointer mirror removed. Real-store proof covers attribute/rename grouping, one undo step, rollback and external-mutation refusal while UI/status remain usable.
- Onboarding depends on content-data's pageFromTree in the existing page owner. Regenerate its source-aware patches against current source after that dependency; do not overwrite shared files with stale mirrors. Real PNG thumbnails remain absent because B was forbidden to run Chrome.
- Production security OPEN items remain with A: archive inflation before bounded-size enforcement; existing preview accepts overly broad opaque-origin keyboard messages until the supplied policy utility is wired. These are documented, not claimed fixed.
- No shared source/manifest/spec/docs/tests, Git, gate, generators, inventory or Chrome were changed/run by B. Initial alternative extension folder names were withdrawn; only the six folders above belong to this handoff.

### Waiting on the user
- An Anthropic service key is required only for an eventual real-provider check. No credential was entered or fabricated. B is closed regardless; A owns continuation.
