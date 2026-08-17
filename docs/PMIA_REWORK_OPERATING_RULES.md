# PMIA Rework Operating Rules

## Purpose
This file is the durable operating contract for agents working on PMIA 0.12+.
Read it before editing code, running browser tests, changing deployment, or redesigning UI.

## Product priorities
1. Speed is the highest priority after correctness and lossless delivery.
2. Keep the runtime as small and direct as possible.
3. Prefer one clear owner per responsibility; avoid duplicate state machines, pipelines, ledgers, and recovery layers.
4. Debuggability is mandatory: failures must identify the exact delivery boundary without noisy continuous logging.
5. User-facing value must justify every added state, timer, observer, module, or persisted record.

## Core invariant
`W1 rendered user turn -> direct extension fan-out -> W2 + W3 in parallel -> exact composer write -> real submit -> rendered user-turn proof`.
Backend receipt, queue admission, composer fill, or click dispatch alone are not success.

## Window roles
- W1 is the transcription/source window.
- W2 and W3 are equal production answer lanes.
- W3 is not experimental, secondary, best-effort, or lower priority.
- W2 and W3 must have identical delivery priority, FIFO behavior, reconnect replay, proof requirements, Review metrics, markers, export fields, window tools, and performance expectations.
- W2/W3 will commonly use different vendors (ChatGPT and Claude), but either provider may occupy either lane.
- Two-window operation may remain as a fallback mode, but three-window mode is the production default.

## Submit/focus rule
- Never send Enter blindly.
- Before a keyboard submit, confirm the intended provider composer is the focused editable target.
- If focus is on browser chrome, another control, another window, or an unrelated editable, do not submit.
- Prefer provider-native submit/form APIs when they target the exact verified composer.
- After submit, require the exact text to appear as a new rendered user turn.

## Delivery architecture rules
- Keep AutoHotkey out of the live delivery hot path unless measurement proves it is faster and more reliable than browser-native delivery.
- Preferred hot path: long-lived extension ports and provider-native page writers.
- No global question sequence unless a demonstrated bug requires it; per-role FIFO ordering is preferred.
- No Runtime Pilot, batch planner, gap machine, recovery scheduler, or duplicate delivery owner in the active graph.
- Persist only bounded metadata needed for explicit Review/End/reconnect behavior.
- Never persist raw Resume, JD, provider answer text, cookies, tokens, or credentials.

## Logging and diagnostics
- Keep the normal log small: captured, fanout, composer_written, submitted, rendered, failed.
- Log timestamps, role, turn ID, elapsed time, and concise reason only.
- Do not add flashing resync states, continuous diagnostic polling, or duplicate timelines.
- Debug features must be one-shot or event-driven and must not delay delivery.

## UX rules
- Keep Studio web-based and visually simple; AutoHotkey should be only an optional bootstrap helper.
- Keep the cockpit as a short bottom dock with a small primary control set.
- Secondary functions belong in one compact Tools/Help surface, not extra full-size tabs.
- Avoid operator jargon in the live UI; prefer Ready, Waiting, Delivery issue, Latest answer.
- Window 2 and Window 3 must expose the same user-facing controls and status language.

## Feature migration rule
For each older feature, decide: keep, simplify, defer, or drop.
Keep only features with clear interview value that can remain outside the delivery hot path.
If a feature adds meaningful state/latency/failure modes, simplify the outcome rather than porting the old machinery.
Do not restore old infrastructure merely to preserve feature names.

## Development workflow
- Diagnose from current code and real evidence before patching.
- Plan first, review the plan for correctness, performance, and complexity, then implement.
- Focus primarily on implementation/design; run focused tests after meaningful batches instead of cycling full suites after every small edit.
- Preserve unrelated work and dirty `main`; use the isolated PMIA 0.12 worktree/branch.

## Testing policy
- Prefer code review/simulation/focused contract tests while implementing a substantial feature batch.
- Run full release gates after meaningful implementation milestones, before deployment, and before final completion claims.
- Real acceptance requires actual provider composer write, actual submit, and rendered user-turn proof.
- Measure PMIA transport latency separately from provider/model generation latency.
- Performance target: no intentional W2/W3 serialization; PMIA fan-out overhead should be effectively negligible relative to provider latency.

## Browser/session safety while agents work
- Background/off-screen operation is a development constraint, not a product architecture constraint.
- Do not clear cookies, tokens, browser storage, profiles, sessions, or provider authentication.
- Do not close/delete unrelated tabs/windows/processes.
- Clean only task-created PMIA test windows/files and restore foreground focus after any unavoidable foreground diagnostic.

## Source-control and deployment
- Work on `feature/pmia-simple-runtime`; preserve dirty `main` unless explicitly instructed otherwise.
- Keep PMIA 0.11 available as rollback until 0.12 is fully accepted.
- Sync/install only from a verified 0.12 source snapshot.
- Do not merge into dirty `main` as part of ordinary verification.
- Commit/push only when explicitly authorized by the user.
