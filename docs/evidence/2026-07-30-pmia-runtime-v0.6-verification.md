# PMIA Runtime v0.6 Verification — 2026-07-30

## Release scope

This record verifies the PM-only dual-provider runtime before integration into `main` and release as `pmia-runtime-v0.6.0`.

- Feature branch: `feature/runtime-0.6-operations`
- Verified code commit: `fdcfd043dff327e418988765f89328b98cd2d226`
- Browser: Microsoft Edge Stable, Profile 1 (`Default`)
- Extension version: `0.6.0`
- Registered unpacked path resolved to the feature worktree during candidate verification.

All markers and context were synthetic. Resume, Job Description, provider account data, conversation bodies, cookies, credentials, and request URLs containing identifiers are excluded.

## Exact candidate automated gate

The complete gate was run fresh on the clean feature tree:

- Node test suite: **249 passed, 0 failed**
- The full Node suite was repeated by the runtime validator: **249 passed, 0 failed**
- Extension validation: **57 JavaScript files checked**
- AutoHotkey v2 runtime validation: **passed**
- `git diff --check`: **passed**
- Working tree before live verification: **clean**

The runtime keeps provider previews disposable, durable finals sequenced, receiver submission idempotent, and browser/profile launch diagnostics read-only.

## Four-route live matrix on the final code commit

Each route used a unique session and exact marker. Success required one provider user turn, one exact acknowledgement, no `FINAL QUEUED` state, and no matching text remaining in the receiver composer.

| Route | Provider result | Exactly-once result |
|---|---|---|
| ChatGPT -> ChatGPT | One user turn and one answer rendered; sender and receiver remained linked | Passed; no queue and clean composer |
| ChatGPT -> Claude | One user turn and one exact Claude answer rendered | Passed; no queue and clean composer |
| Claude -> ChatGPT | One user turn and one exact ChatGPT answer rendered | Passed; no queue and clean composer |
| Claude -> Claude | One user turn and one exact Claude answer rendered | Passed; no queue and clean composer |

The final route records were sampled from the running provider DOM and PMIA status layer. Nested accessibility copies were not counted as additional provider turns; stable provider message identity and top-level role ownership were used where ChatGPT rendered parallel DOM views.

## Final Claude -> Claude hidden second-turn gate

A clean Claude -> Claude session reached lifecycle `READY` in nine seconds.

First turn:

- Receiver prompt appeared: **1.267 s** after sender submit
- Response generation observed: **3.801 s**
- Exact acknowledgement completed: **6.151 s**
- Prompt count: **1**
- Acknowledgement count: **1**
- Matching receiver composer text after completion: **0**

Both managed windows were then moved off-screen through PMIA's own Alt+Tab hide operation.

- Hidden duration: **70.058 s**
- Both windows remained off-screen for the full interval.
- After restoration, both runtimes reported `LINK OK` and exposed live composers.

Second turn after restoration:

- Receiver provisional/prefill appeared: **0.826 s** after sender submit
- Submitted receiver turn was stable: **3.159 s**
- Response generation observed: **3.470 s**
- Exact acknowledgement completed: **4.991 s**
- Prompt count: **1**
- Acknowledgement count: **1**
- Matching receiver composer text after completion: **0**

This verifies sender observation, receiver registration, staged composer recovery, automatic submission, response start, exactly-once delivery, and cleanup beyond the former heartbeat/sleep boundary.

## Shutdown and cleanup behavior

PMIA Alt+Delete was sent through the production hotkey path at `2026-07-30 13:55:06`.

Two checks three seconds apart confirmed:

- Managed PMIA Edge windows remaining: **0**
- PMIA AutoHotkey launcher processes remaining: **0**
- Unrelated Edge state was not targeted.

## Legacy parity retained and improved

The v0.6 runtime preserves the useful behavior of the legacy two-window system:

- Fast provider-window launch and deterministic layout
- Off-screen hide/restore without destroying the interview session
- Direct PM interview hotkeys for layout, mute, scrolling, export, and shutdown
- Immediate provider-specific handling rather than generic long sleeps

The release improves the legacy design with active runtime preflight, provider-specific final boundaries, staged first-question context, bounded tracking, exactly-once sequencing, wake-and-retry delivery, path/version diagnosis, and session-scoped cleanup.

## Release integration

- The feature branch was published at the verification-report commit before local integration.
- Canonical `main` was fast-forwarded without conflicts or unrelated changes.
- The complete merged-main gate passed: **249 tests**, **57 JavaScript files**, AutoHotkey v2 validation, clean diff, and clean status.
- Both compatibility junctions now target canonical `main/runtime/extension` directly.
- Edge reloaded only the PMIA card in Profile 1; Profile Doctor returned `OK`, version `0.6.0`, and an exact canonical path match.
- **45** task-created PMIA temp files and the temporary Browser Evidence verification copy were removed.
- The merged feature worktree and local feature branch were removed; the remote feature branch remains as release provenance.
- Legacy launchers, session tracker, Tampermonkey fallback directories, and unrelated Edge windows remain intact.

Remote `main` and tag `pmia-runtime-v0.6.0` are verified after publication to resolve to the release commit containing this record.
