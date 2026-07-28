# Evidence-Driven Turn-Boundary Runtime Implementation Plan

> Execute with test-driven development in the existing `feature/dual-provider-extension` worktree.

**Goal:** Replace generic transcript timing with provider-specific, evidence-backed turn finalization; preserve durable delivery; consolidate the project into one canonical repository and one verified raw-evidence archive.

**Architecture:** Provider adapters expose ordered messages. Provider-specific sender strategies emit completed turns into the unchanged session router. Claude uses final voice JSON events; ChatGPT uses ordered DOM turn boundaries.

**Stack:** Manifest V3 JavaScript modules, Node test runner, AutoHotkey v2, PowerShell validation, Git/GitHub.

---

## Task 1: Add ordered message extraction

**Files**
- Modify: `runtime/extension/content/adapters/shared.js`
- Modify: `runtime/extension/content/adapters/chatgpt.js`
- Modify: `runtime/extension/content/adapters/claude.js`
- Test: `runtime/extension/tests/adapters.test.js`

**Steps**
1. Add failing tests for ordered role messages and stable IDs.
2. Implement `getConversationMessages()` with explicit ID priority and retained element fallback.
3. Ensure hidden composer/shadow textareas cannot become conversation messages.
4. Run adapter tests, then the full suite.
## Task 2: Implement ChatGPT turn tracker

**Files**
- Create: `runtime/extension/content/senders/chatgpt-turn-tracker.js`
- Test: `runtime/extension/tests/chatgpt-turn-tracker.test.js`

**Steps**
1. Encode the captured partial transcript progression as sanitized fixtures.
2. Prove partial changes and composer drafts do not emit.
3. Prove a following assistant message emits the complete user turn immediately.
4. Add conservative fallback behavior with reset-on-change.
5. Prove historical IDs and already-emitted IDs remain suppressed.

## Task 3: Harden Claude voice finalization

**Files**
- Modify: `runtime/extension/content/signals/protocol.js`
- Modify: `runtime/extension/content/signals/claude-main.js`
- Modify: `runtime/extension/content/signals/claude-runtime.js`
- Test: `runtime/extension/tests/claude-signals.test.js`

**Steps**
1. Add failing tests for `server_interrupt`, `transcript_empty`, repeated boundaries and duplicate UUIDs.
2. Treat these events as state/status changes, never completed questions.
3. Preserve human `message_complete` as the only voice final.
4. Keep all binary frames ignored.
## Task 4: Introduce provider sender strategies

**Files**
- Create: `runtime/extension/content/senders/dom-turn-tracker.js`
- Create: `runtime/extension/content/senders/provider-sender.js`
- Modify: `runtime/extension/content/entry.js`
- Modify: `runtime/extension/content/observation/provider-observer.js`
- Test: `runtime/extension/tests/runtime.test.js`
- Test: `runtime/extension/tests/validation.test.js`

**Steps**
1. Add integration tests proving `entry.js` selects provider-specific strategies.
2. Remove automatic composer routing from normal observation.
3. Baseline historical messages before observers start.
4. Suppress Claude DOM duplicates after a WebSocket voice final.
5. Retain F12 as an explicit manual flush.
6. Keep service-worker routing interfaces unchanged.

## Task 5: Clean implementation defects and version the release

**Files**
- Modify: `runtime/extension/shared/sequence.js`
- Modify: `runtime/extension/content/signals/protocol.js`
- Modify: `runtime/extension/manifest.json`
- Modify: `runtime/extension/README.md`
- Test: `runtime/extension/tests/manifest.test.js`

**Steps**
1. Correct malformed line joins found during review.
2. Set the extension version to `0.3.0`.
3. Document provider boundaries, fallback behavior and remaining manual validation.
4. Run extension validation.
## Task 6: Consolidate the evidence capture tool

**Files**
- Create: `tools/browser-evidence-capture/README.md`
- Add current v7 source, build script and tests from the dedicated local tool folder.
- Modify: `.gitignore`

**Steps**
1. Copy only source, tests and build instructions into the repository.
2. Exclude raw captures, generated ZIPs, node modules and local browser output.
3. Verify the preserved v6 baseline is unnecessary for runtime operation; keep it only inside the raw archive.
4. Run capture-tool syntax and unit tests from the canonical source location.

## Task 7: Create and verify the canonical raw-evidence archive

**Files**
- Local only: `.local/evidence/pmia-raw-evidence-2026-07-28.zip`
- Local only: `.local/evidence/manifest.json`
- Create sanitized repository report: `docs/evidence/2026-07-28-provider-turn-boundary-findings.md`

**Steps**
1. Inventory all project evidence and compute SHA-256 hashes.
2. Preserve the two new full-session ZIPs and prior unique evidence worth retaining.
3. Exclude duplicate copies, node modules, generated caches and source already tracked in Git.
4. Build one ZIP and a manifest containing source path, size and hash.
5. Test every archive entry and re-hash the completed archive.
6. Keep raw evidence outside Git; commit only sanitized findings.
## Task 8: Verify, merge, push and clean local duplicates

**Steps**
1. Run all extension tests, extension validation, AutoHotkey validation, capture-tool tests, syntax checks, diff checks and secret scans.
2. Commit the evidence-driven rewrite on `feature/dual-provider-extension`.
3. Merge into local `main` while preserving the existing local `.worktrees` ignore commit.
4. Repeat the complete verification on merged `main`.
5. Push `main` to `thomas-shelby006/product-pm-interview-assistant-instructions` and verify the remote commit.
6. Remove the merged worktree and feature branch.
7. Delete verified project duplicates:
   - `Documents\PM Interview Assistant`
   - `Documents\pm-interview-browser-evidence-tool`
   - obsolete project ZIPs and runtime logs
   - duplicate raw ZIPs in Downloads after archive verification
8. Inspect the separate session-tracker repository before deletion; preserve unique content in the archive or canonical repo first.
9. Confirm the final Documents/Desktop footprint, reclaimed bytes, clean Git status and archive integrity.

## Completion criteria

- No partial ChatGPT voice turn can be emitted by a short generic timer.
- Claude emits only final human `message_complete` turns.
- Typed composer drafts never auto-route.
- Existing durable delivery and idempotency tests remain green.
- One canonical GitHub repository contains the working source.
- One ignored, verified raw-evidence archive remains locally.
- Duplicate project folders, old generated packages and temporary logs are removed.