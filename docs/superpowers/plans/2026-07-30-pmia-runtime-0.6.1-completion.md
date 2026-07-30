# PMIA Runtime 0.6.1 Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining operational PMIA work by adding structured session context and making the session-tracker workflow compatible with the released Edge Stable Manifest V3 runtime.

**Architecture:** Keep the v0.6 preview/final transport, provider adapters, service worker, sequencing, and recovery unchanged. Extend the AutoHotkey control plane only: Session Studio builds a structured, memory-only metadata block, while the tracker helper discovers the single active PMIA session, exports both role logs through the current extension shortcut, and locates the generated Markdown files safely.

**Tech Stack:** AutoHotkey v2, PowerShell 7/Windows PowerShell, Manifest V3 JavaScript tests, Node.js test runner, Microsoft Edge Stable, Git.

## Global Constraints

- Preserve `Final_2_Window_Fixed.ahk`, Tampermonkey scripts, archives, and unrelated browser state.
- Do not change the proven v0.6 transport or provider finalization rules without a reproduced defect.
- Resume, JD, structured metadata, notes, prompts, and answers remain process-memory only.
- Persist only Edge profile, provider route, and layout preferences.
- Do not enable Edge Beta or Tampermonkey beside the active extension runtime.
- Use synthetic data for tracker verification; never push real interview content during this task.
- Run one complete final gate after the coherent implementation batch.

---

### Task 1: Structured Session Studio metadata

**Files:**
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Test: `runtime/extension/tests/launcher.test.js`

**Interfaces:**
- Produces: `BuildSessionMetadataBlock()` returning a labeled session-context string.
- Consumes: existing `BuildBootPrompt()`, Session Studio controls, and process-memory globals.

- [ ] Add failing launcher tests for company, target role, round, emphasis, avoid-list, answer mode, freeform notes, memory-only handling, and complete control cleanup.
- [ ] Run `node --test runtime/extension/tests/launcher.test.js` and confirm the new contracts fail.
- [ ] Add structured controls to Session Studio without hiding Resume, JD, layout, status, or launch actions.
- [x] Build the exact labels `Company`, `Target role`, `Interview round`, `Emphasis`, `Avoid mentioning`, and `Answer mode`; append optional notes under `Additional notes`.
- [x] Read structured values only when launching or resending; do not write them to `settings.ini`.
- [x] Destroy and zero every new control reference when Session Studio closes.
- [x] Run the focused launcher tests and AutoHotkey `--validate` path.
- [x] Commit the structured Studio slice.

### Task 2: Current-runtime session tracker

**Files:**
- Modify: `runtime/Session_Tracker_End_Session.ahk`
- Modify: `runtime/scripts/push-session-to-tracker.ps1`
- Create: `runtime/extension/tests/session-tracker-helper.test.js`

**Interfaces:**
- Produces: one complete managed-session discovery result with sender/receiver HWNDs and session suffix.
- Produces: newest sender/receiver Markdown export paths created after a known export start time.
- Consumes: current `PMIA_*` lifecycle titles, launcher `PMIA_RUNTIME_CONTROL_V1`, Edge Downloads directory, exact export resolver, and tracker push script.

- [x] Add failing tests proving legacy `VB_*` titles and `Ctrl+Shift+F9` are absent.
- [x] Add failing tests for exact PMIA session pairing, ambiguous-session rejection, current export shortcut, UTF-8 GUI title, and automatic export discovery.
- [x] Implement hidden-window-aware discovery of one complete sender/receiver pair sharing the same session suffix.
- [x] Request both role exports through the launcher control channel, resolve one exact fresh Markdown pair, and fill the two file controls automatically.
- [x] Preserve manual Browse controls as recovery, but explain exact errors instead of reporting success blindly.
- [x] Add a `-DryRun` push-script path that validates and stages a synthetic session folder without Git commit, branch, merge, or remote writes.
- [x] Run focused tracker tests, AutoHotkey validation, and a synthetic dry-run against a temporary tracker clone/copy.
- [x] Commit the tracker compatibility slice.

### Task 3: Documentation and stale-work resolution

**Files:**
- Modify: `README.md`
- Modify: `runtime/README_INSTALL_TEST.md`
- Modify: `runtime/extension/README.md`
- Modify: `AHK_PHASE_2_IMPLEMENTATION_PLAN.md`
- Modify: `ARCHITECTURE_FIRST_PRINCIPLES_REVIEW.md`
- Create: `docs/evidence/2026-07-30-pmia-runtime-v0.6.1-verification.md`

**Interfaces:**
- Documents the active Edge Stable/Manifest V3 workflow and the completed session metadata/tracker boundaries.
- Removes obsolete claims that structured fields or supersede are still deferred.

- [x] Update active docs with structured metadata, tracker export discovery, dry-run behavior, privacy boundary, and recovery steps.
- [x] Mark the old Phase 2 document as historical/completed without deleting its reference material.
- [x] Record synthetic verification only; exclude provider account data, Resume/JD bodies, cookies, tokens, and conversation content.
- [x] Run stale-reference, encoding, and secret-pattern scans.
- [ ] Commit the documentation slice.

### Task 4: Final verification and delivery

**Files:**
- Modify only release/version files if the verified change warrants `0.6.1`.

- [x] Run `npm test`, `npm run validate`, and `runtime\Validate_Extension_Runtime.ps1` once on the complete batch.
- [x] Run `git diff --check`, inspect the complete diff, and confirm unrelated files remain untouched.
- [ ] Launch Session Studio and verify structured fields reach `BuildBootPrompt()` using synthetic values without persisting them.
- [x] Verify tracker helper discovers a synthetic/current PMIA pair or returns a precise no-session error; verify `-DryRun` creates no Git or remote changes.
- [ ] Update the verification record with exact results and commit the final tree.
- [ ] Push the feature branch and fast-forward `main` only after the exact final tree passes.
- [ ] Tag `pmia-runtime-v0.6.1` only if `main` and the installed runtime are verified at that commit.
- [ ] Update or close GitHub issue #7 as obsolete/completed under Edge Stable, explaining that Edge Beta/Tampermonkey is retired.
- [ ] Remove only the merged worktree and task-created temporary files.
