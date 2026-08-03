# PMIA 0.10.4 Parallel Hardening Design

**Status:** Approved by the user's explicit instruction to make independent decisions and complete the work without pausing for review.

## Objective

Produce PMIA 0.10.4 through four isolated 50-cycle workstreams, integrate only evidence-backed changes, rebuild the stable deployment package, activate the current unpacked extension in Edge when safely automatable, preserve the installed 0.6.1 rollback package, and remove all superseded task traces.

## Current evidence

PMIA 0.10.3 is clean on `main` at `feca2fc60cac5096f9c83ffede93a634c36c8a31`. The complete source gate passed 1,361 tests, 519 JavaScript files, 18 runtime surfaces, and 288 production modules. Two isolated Edge attempts proved Q1, pause/resume state, carryover, independent accumulation, restart recovery, transport health, and cleanup; both failed when anonymous ChatGPT cleared or accepted the combined Q2/Q3 submission without rendering a confirmable user turn.

## Design decisions

1. Keep provider-rendered proof authoritative. Never convert a click, cleared composer, transport acknowledgement, or inferred acceptance into delivery success.
2. Add one bounded recovery path for a submit that clears the composer but produces no user turn and no generation evidence. The second attempt must reuse the same delivery identity and baseline, and remain fail-closed.
3. Separate deterministic browser/runtime verification from the external provider canary. Deterministic extension behavior remains an automated gate; provider rendering is recorded as a distinct canary and requires manual acceptance when limited.
4. Keep release truth four-lane: source/package gate, deterministic browser runtime gate, provider canary, and normal-profile activation gate.
5. Bound recovery-attempt storage independently from the automatic recovery budget so rapid manual repair cannot create unbounded state.
## Workstream boundaries

### Runtime bugfix

Owns `content/runtime.js`, provider adapter composer-read contracts, focused runtime tests, and a 50-cycle bug ledger. It must reproduce the empty-composer swallowed-submit case before changing behavior.

### Low-level design

Owns `shared/recovery-budget.js`, its tests, and a 50-cycle LLD ledger. It may add explicit constructor limits and normalization helpers but must not alter automatic recovery semantics.

### High-level design

Owns the release-verification architecture record, import/topology enforcement tests, and a 50-cycle HLD ledger. It must encode separation between deterministic gates and external canaries without importing deployment scripts into extension production code.

### Deployment polish

Owns isolated-smoke orchestration, evidence-manifest generation, readiness/inventory scripts, active deployment documentation, and a 50-cycle operator-polish ledger. It must preserve failed provider attempts as diagnostics and must not label an advisory canary as passed.

## Data and control flow

A receiver submission records baseline user-turn identities, writes the exact prompt, triggers submit, and waits for a new rendered user turn. When the first click clears the composer but no new turn or generation appears after the guarded retry threshold, the runtime rewrites the same prompt once and retries. Success still requires a new rendered user turn relative to the original baseline.

The isolated browser harness collects deterministic extension identity, self-test, command reachability, Adaptive Turn module scenarios, dashboard reflow/accessibility, transport drill, storage/cleanup, and exact source binding. Live provider rendering is collected in a separate canary object with `passed`, `limited`, or `failed` status and reason-coded evidence.
## Failure handling

- A retry is prohibited while generation is active, when the delivery identity is superseded, or when a matching rendered user turn already exists.
- A second unconfirmed submit returns `rendered_turn_not_confirmed`; ledger ownership remains protected and recovery remains reason-coded.
- Deterministic browser failure blocks packaging readiness.
- Provider canary limitation does not become success; it changes release status to `provider_limited` and requires a real-provider manual test.
- Normal-profile activation remains incomplete until Profile Doctor reports the expected version and path.

## Verification

Each worktree runs a focused baseline and final suite. Integration runs one complete source gate, isolated deterministic browser smoke, optional live provider canary, package verification, AutoHotkey parsing, Profile Doctor, inventory generation, HTML audit, worktree manifest, and final diff review.

Official platform research supports this boundary: Microsoft Edge documents Reload for locally updated unpacked extensions and Load unpacked for first installation; Chromium documents Manifest V3 service workers as restartable and recommends browser-loaded end-to-end extension testing. The design therefore keeps activation explicit and makes the deterministic extension test independent from an uncontrolled provider response.

## Non-goals

- No remote API integration, store publication, enterprise policy, cloud deployment, or dependency upgrade.
- No weakening of rendered proof, sequence admission, ledger durability, or pause semantics.
- No broad rewrite of the large pilot controller, dashboard, background service worker, or launcher.
- No removal of the 0.6.1 archive until the user explicitly replaces the rollback baseline.

## Acceptance

The result is complete when all four 50-cycle ledgers exist, every implemented change has focused tests, integrated `main` is clean, the complete gate passes, current is atomically rebuilt as 0.10.4, only 0.6.1 archive and 0.10.4 current remain, Edge activation status is verified honestly, and all campaign worktrees, branches, temporary evidence, and helper files are removed.