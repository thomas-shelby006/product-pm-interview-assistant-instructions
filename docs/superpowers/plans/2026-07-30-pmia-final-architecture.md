# PMIA Final Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the PM-only Manifest V3 interview runtime with event-driven exactly-once finalization and non-disruptive verification.

**Architecture:** Provider previews update a disposable receiver staging lane. ChatGPT commits only on an assistant-successor boundary; Claude commits only on human `message_complete`. The receiver confirms staged text and submits once. AutoHotkey retains only PM interview operations and gains a hidden verification launch path.

**Tech Stack:** Manifest V3 JavaScript extension, Node.js test runner, AutoHotkey v2, PowerShell validators, Microsoft Edge.

## Global Constraints

- Preserve all legacy files and unrelated work.
- Do not add dependencies or private provider API calls.
- Do not open visible verification windows or steal foreground focus.
- Commit and push only after exact verification; do not move the existing v0.5.0 tag.
- Release the completed work as v0.6.0 only after merged-main verification.

---

### Task 1: Authoritative provider finalization

**Files:**
- Modify: `runtime/extension/content/senders/dom-turn-tracker.js`
- Modify: `runtime/extension/content/senders/provider-sender.js`
- Modify: `runtime/extension/content/entry.js`
- Modify: `runtime/extension/content/signals/claude-main.js`
- Test: `runtime/extension/tests/chatgpt-turn-tracker.test.js`
- Test: `runtime/extension/tests/provider-sender.test.js`
- Test: `runtime/extension/tests/claude-signals.test.js`

- [x] Add failing ChatGPT navigation/streaming duplicate tests.
- [x] Disable stable-tail final emission for the ChatGPT runtime while preserving preview revisions.
- [x] Deduplicate replacement IDs by canonical user text and preserve genuine ordered repeats.
- [x] Map Claude `server_interrupt` to interruption and `transcript_empty` to reset.
- [x] Run the focused sender and Claude signal tests.

### Task 2: PM-only AutoHotkey surface

**Files:**
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Modify: `runtime/Validate_Extension_Runtime.ps1`
- Modify: `runtime/extension/tests/validation.test.js`
- Modify: `runtime/README.md`

- [x] Add tests asserting the active runtime has no screenshot or coding hotkeys.
- [x] Remove Alt+S screenshot capture, screenshot prompt state, and coding compatibility handlers.
- [x] Keep launch, resend, exit, hide/restore, layout, mute, scroll lock, and export.
- [x] Use the existing `--validate` invocation, which exits before Session Studio or managed windows can open.
- [x] Validate AutoHotkey v2 syntax and shortcut allowlist.

### Task 3: Exact release verification and delivery

**Files:**
- Modify: `docs/plans/2026-07-29-runtime-0.5-verification.md` or create a v0.6 verification record.
- Modify: `README.md` and extension manifest version only where release facts require it.

- [x] Run the complete automated gate once on the final candidate.
- [x] Commit the final candidate and reload the exact unpacked extension without opening foreground windows.
- [x] Run ChatGPT→ChatGPT, ChatGPT→Claude, Claude→ChatGPT, and Claude→Claude live routes with retained evidence.
- [x] Run the >60-second minimized/background route and safe Alt+Delete shutdown gate.
- [ ] Commit verification evidence, push the feature branch, merge to main, rerun the complete gate, push main, and create `pmia-runtime-v0.6.0`.
- [ ] Repoint the stable Edge compatibility junction to canonical main, reload, verify profile doctor, remove only task-created temporary files and the merged worktree, and confirm old files remain.
