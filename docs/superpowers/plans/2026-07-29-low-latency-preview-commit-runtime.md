# Low-Latency Preview/Commit Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and test-driven-development task-by-task.

**Goal:** Mirror dictated text to the receiver as it grows, but submit exactly once only after the strongest evidence-backed provider final boundary.

**Architecture:** Add an ephemeral preview lane beside the durable final lane. Claude interim frames and ChatGPT DOM text growth update the receiver composer immediately; Claude human `message_complete` and ChatGPT assistant-successor commit the final question. Preview data is never queued, persisted, or accepted as a final envelope.

**Tech Stack:** Manifest V3 JavaScript modules, Chrome runtime messaging, MutationObserver, Node test runner, AutoHotkey v2, PowerShell validation.

## Global Constraints

- Do not depend on undocumented ChatGPT WebRTC/data-channel payloads.
- Ignore all binary Claude voice frames.
- Never auto-route composer drafts.
- Never submit a preview.
- Active voice disables timer-based finalization.
- Preserve sender/receiver ownership, final sequence idempotency, latest-final queueing, and per-role bounded logs.
- Use no new dependencies.

---

### Task 1: Define the ephemeral preview contract

**Files:**
- Create: `runtime/extension/shared/preview.js`
- Modify: `runtime/extension/background.js`
- Test: `runtime/extension/tests/preview.test.js`

**Interfaces:**
- Produces `makePreview({sessionId, sourceProvider, text, turnKey, revision, phase, now})`.
- Adds `PMIA_PREVIEW` sender-to-worker and `PMIA_PREVIEW_DELIVER` worker-to-receiver messages.
- Preview delivery validates sender ownership but bypasses final sequence state, pending queues, and logs.

- [ ] Write tests proving invalid/stale previews are rejected and valid previews route only to the current receiver.
- [ ] Prove an absent receiver drops preview without creating pending state.
- [ ] Implement the minimal contract and background route.
- [ ] Run `node --test runtime/extension/tests/preview.test.js`.

### Task 2: Emit provider-specific provisional text

**Files:**
- Modify: `runtime/extension/content/senders/dom-turn-tracker.js`
- Modify: `runtime/extension/content/senders/provider-sender.js`
- Modify: `runtime/extension/content/signals/claude-runtime.js`
- Test: `runtime/extension/tests/chatgpt-turn-tracker.test.js`
- Test: `runtime/extension/tests/provider-sender.test.js`
- Test: `runtime/extension/tests/claude-signals.test.js`

**Interfaces:**
- `DomTurnTracker.update()` returns finals and exposes a distinct preview only when tail text changes.
- `createProviderSender()` accepts `onPreview(preview)` and coalesces identical updates.
- Claude `voice_interim` calls `forwardPreview`; human `voice_final` remains the only voice commit.

- [ ] Add failing tests for growing ChatGPT text, duplicate interim suppression, reset clearing, and no final before an assistant successor.
- [ ] Add preview revision and stable turn identity without changing final sequence numbers.
- [ ] Keep active-voice fallback disabled; set non-voice fallback to 1200 ms.
- [ ] Run the three focused test files.

### Task 3: Prefill the receiver without submitting

**Files:**
- Modify: `runtime/extension/content/runtime.js`
- Modify: `runtime/extension/content/entry.js`
- Test: `runtime/extension/tests/runtime.test.js`
- Test: `runtime/extension/tests/preview.test.js`

**Interfaces:**
- Receiver controller adds `preview(preview)` that only writes composer text.
- `deliver(envelope)` replaces preview with the authoritative final and submits once.
- Receiver keeps `lastPreviewRevisionByTurn` and ignores stale preview revisions.

- [ ] Write failing tests proving preview changes composer state but never calls submit.
- [ ] Prove stale revisions cannot overwrite newer text.
- [ ] Prove final delivery submits exactly once with final text even when preview text differs.
- [ ] Implement minimal receiver preview handling and runtime listeners.
- [ ] Run runtime and preview tests.

### Task 4: Reduce observation and answer latency

**Files:**
- Modify: `runtime/extension/content/observation/provider-observer.js`
- Modify: `runtime/extension/content/entry.js`
- Test: `runtime/extension/tests/observer.test.js`
- Test: `runtime/extension/tests/runtime.test.js`

**Interfaces:**
- Provider observer watches `childList`, `subtree`, and `characterData`; it does not observe attributes.
- Watchdog rebind interval is 500 ms and remains fallback-only.
- Answer capture uses provider changes as the primary wake-up path with a 500 ms watchdog; Claude `message_stop` permits immediate final inspection.

- [ ] Add failing tests that attribute-only churn does not trigger extraction.
- [ ] Add timing tests for microtask coalescing and the 500 ms watchdog.
- [ ] Replace the 300 ms hot answer polling loop with observer-driven wakeups plus watchdog.
- [ ] Preserve the 90-second hard timeout and supersede cancellation.
- [ ] Run observer/runtime tests.

### Task 5: Harden release, documentation, and evidence

**Files:**
- Modify: `runtime/extension/manifest.json`
- Modify: `runtime/extension/README.md`
- Create: `docs/evidence/2026-07-29-low-latency-provider-findings.md`
- Modify: `runtime/Validate_Extension_Runtime.ps1` only if validation coverage requires it.

- [ ] Version the extension as `0.4.0`.
- [ ] Document preview versus commit, provider boundaries, latency expectations, and fallback rules.
- [ ] Record sanitized counts and timing ranges from both supplied archives; include no raw identifiers, tokens, URLs with credentials, or audio.
- [ ] Run the full test suite, extension validation, AHK validation, diff check, and secret scan.

### Task 6: Finish both repositories and clean obsolete work

**Files/areas:**
- PM runtime feature worktree and canonical repository.
- `C:\Users\Sundar\Documents\BrowserEvidenceCapture`.
- Local ignored evidence archive and verified duplicate inventory.

- [ ] Complete and commit Browser Evidence Capture smoke-port isolation; run its full `npm run verify` gate.
- [ ] Merge/push/tag Browser Evidence Capture 1.4.0 and verify the installed LocalAppData daemon.
- [ ] Commit the PM runtime rewrite, merge to `main`, rerun all verification, and push.
- [ ] Build one SHA-256-manifested raw-evidence archive outside Git before deleting duplicates.
- [ ] Delete only files proven obsolete or duplicated; retain canonical source, release, installed runtime, and the one verified archive.
- [ ] Confirm clean local and remote branches, archive integrity, and final installed health.

## Completion criteria

- Claude provisional text reaches the receiver on each distinct interim update; only human `message_complete` submits.
- ChatGPT provisional DOM text reaches the receiver on each distinct tail-message update; only assistant successor or non-voice fallback submits.
- No active-voice timer can submit a partial question.
- Preview cannot be queued, persisted, logged as final, or alter final sequence state.
- Receiver preview never submits; authoritative final submits once.
- Observation no longer reacts to provider attribute churn.
- Full PM runtime, Browser Evidence Capture, release, install, Git, archive, and cleanup verification are green.
