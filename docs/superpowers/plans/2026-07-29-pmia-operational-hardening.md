# PMIA Operational Hardening 0.6.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic Microsoft Edge Stable profile doctor, lifecycle-aware launch coordinator, and polished Session Studio that reaches a proven ready state before interview traffic begins.

**Architecture:** Keep the 0.5.3 preview/commit transport unchanged. Add a read-only PowerShell profile inspector, a mutable extension lifecycle title, and an AutoHotkey launch state machine that consumes both signals. Persist only non-sensitive launcher preferences under LocalAppData.

**Tech Stack:** AutoHotkey v2, PowerShell 5.1, Manifest V3 JavaScript modules, Node.js built-in test runner, Microsoft Edge Stable.

## Global Constraints

- Use Microsoft Edge Stable only; install no browser.
- Do not read cookies, tokens, private provider APIs, or raw audio.
- Do not persist Resume, Job Description, notes, prompts, or answers.
- Do not alter the 0.5.3 preview/commit routing semantics.
- Do not modify or delete legacy launchers, archives, Tampermonkey assets, or rollback files.
- Close only windows whose titles match PMIA lifecycle prefixes.
- Every task ends with focused tests and a commit.

---
### Task 1: Edge Profile Doctor

**Files:**
- Create: `runtime/Browser_Profile_Doctor.ps1`
- Create: `runtime/extension/tests/browser-profile-doctor.test.js`

**Interfaces:**
- Produces `Get-PmiaEdgeProfiles -UserDataRoot -ExpectedExtensionPath`.
- CLI emits one UTF-8 TSV record per profile with fields: `directory`, `displayName`, `extensionId`, `registeredPath`, `resolvedPath`, `version`, `pathMatches`, `issueCode`, `issueMessage`.

- [ ] **Step 1: Write fixture-driven failing tests**

Create temporary `Default` and `Profile 2` directories with minimal `Preferences` and `Secure Preferences` JSON. Assert selection favors an enabled-path-match entry and reports version/path mismatches precisely.

- [ ] **Step 2: Run the focused test**

Run: `node --test runtime/extension/tests/browser-profile-doctor.test.js`
Expected: FAIL because the doctor script does not exist.

- [ ] **Step 3: Implement the read-only doctor**

Use `ConvertFrom-Json`, `Resolve-Path`, and `service_worker_registration_info.version`. Never write browser files. Normalize junction targets before comparing paths.

- [ ] **Step 4: Run focused and syntax tests**

Run the Node test and `[scriptblock]::Create((Get-Content -Raw runtime/Browser_Profile_Doctor.ps1))`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add Edge profile doctor`

### Task 2: Mutable Runtime Lifecycle Titles

**Files:**
- Modify: `runtime/extension/content/runtime.js`
- Modify: `runtime/extension/content/entry.js`
- Modify: `runtime/extension/tests/runtime.test.js`
- Modify: `runtime/extension/tests/validation.test.js`

**Interfaces:**
- Add `runtimeLifecycleTitle(config, phase)` where phase is `boot`, `registered`, or `ready`.
- Extend `defendTitle()` with `setTarget(nextTitle)` while preserving `disconnect()`.

- [ ] **Step 1: Write failing lifecycle-title tests**

Assert boot and registered titles are distinct, ready equals the existing final PMIA title, and `setTarget()` updates the defended title without creating another observer.

- [ ] **Step 2: Run focused tests**

Run: `node --test runtime/extension/tests/runtime.test.js runtime/extension/tests/validation.test.js`
Expected: FAIL at missing lifecycle interfaces.

- [ ] **Step 3: Implement lifecycle promotion**

Start at `PMIA_BOOT_*`. Promote to `PMIA_REGISTERED_*` after `PMIA_REGISTER` succeeds. Promote to the existing `PMIA_<ROLE>_*` title only when `adapter.findComposer()` returns a visible composer. Recovery registration must re-evaluate the phase.

- [ ] **Step 4: Verify lifecycle tests and full extension validation**

Run the focused tests and `npm run validate`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: expose PMIA runtime lifecycle titles`

### Task 3: Launcher Preferences and Doctor Bridge

**Files:**
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Modify: `runtime/extension/tests/launcher.test.js`

**Interfaces:**
- Add `LoadStudioPreferences()`, `SaveStudioPreferences()`, `RunProfileDoctor()`, `SelectRecommendedProfile()`, and `RefreshRuntimeDoctor()`.
- Store settings at `%LOCALAPPDATA%\PMInterviewAssistant\settings.ini`.

- [ ] **Step 1: Write failing launcher contracts**

Assert the launcher stores only profile, sender, receiver, and layout keys; invokes the doctor through `WScript.Shell.Exec`; passes the canonical extension path; and never writes Resume, JD, notes, session IDs, prompts, or answers.

- [ ] **Step 2: Run launcher tests**

Run: `node --test runtime/extension/tests/launcher.test.js`
Expected: FAIL at missing doctor and preference functions.

- [ ] **Step 3: Implement preference and doctor parsing**

Parse TSV records into AHK maps. Prefer a saved valid profile; otherwise choose the path-matching PMIA profile; otherwise choose `Default`. Treat malformed records as `PROFILE_DOCTOR_FAILED` without crashing the Studio.

- [ ] **Step 4: Verify launcher and AutoHotkey syntax**

Run launcher tests and `runtime/Validate_Extension_Runtime.ps1`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add PMIA profile preferences and doctor bridge`

### Task 4: Launch Coordinator and Repair Flow

**Files:**
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Modify: `runtime/extension/tests/launcher.test.js`

**Interfaces:**
- Add `SetLaunchState(code, message, tone)`, `WaitForLifecycleTitle()`, `DiagnoseLaunchFailure()`, `RunManagedLaunch()`, and `RepairLaunch()`.
- Launch uses `--profile-directory="<selected>"` and the existing Edge Stable executable.

- [ ] **Step 1: Write failing launch-state tests**

Assert every state transition, lifecycle timeout classification, selected-profile argument, lifecycle-window cleanup regex, and absence of generic Win1/Win2 registration popups.

- [ ] **Step 2: Run launcher tests**

Expected: FAIL at missing coordinator and error codes.

- [ ] **Step 3: Implement condition-driven launch**

Poll at 100 milliseconds. Detect boot, registered, and ready titles independently for sender and receiver. Send boot context immediately after both ready titles appear. Preserve exact PMIA-only window closure.

- [ ] **Step 4: Implement repair**

Rerun the doctor. For registration/version/path issues, open `edge://extensions/?id=<extensionId>` in the selected profile. For partial lifecycle failures, close only the failed PMIA lifecycle windows and relaunch the same session route.

- [ ] **Step 5: Verify and commit**

Run launcher tests and AutoHotkey validation.
Commit: `feat: add lifecycle-aware PMIA launch repair`

### Task 5: Session Studio UI and Inline Confirmation

**Files:**
- Modify: `runtime/Final_2_Window_Extension.ahk`
- Modify: `runtime/extension/tests/launcher.test.js`

**Interfaces:**
- Add `RenderDoctorStatus()`, `RunStudioPreflight()`, `ArmShortContextConfirmation()`, and `ResetShortContextConfirmation()`.
- Expose controls for profile selection, Preflight, Repair, Swap, Close, and Launch.

- [ ] **Step 1: Write failing UI contracts**

Assert the 960-by-780 Studio contains the browser/profile health header, route cards, context counters, launch progress, and all four actions. Assert no expected operational failure uses `MsgBox`.

- [ ] **Step 2: Add inline short-context behavior tests**

The first short-context launch click must arm `Launch Anyway` for ten seconds. The second proceeds. Editing Resume/JD or expiration resets the state.

- [ ] **Step 3: Implement the redesigned Studio**

Use Segoe UI, restrained navy/slate surfaces, green/amber/red health text, one dominant launch action, and keyboard/default-button behavior. Keep every control reference cleared on close.

- [ ] **Step 4: Persist non-sensitive choices**

Save profile, provider route, and layout after user changes. Do not persist context edits.

- [ ] **Step 5: Verify and commit**

Run launcher tests and AutoHotkey validation.
Commit: `feat: redesign PMIA Session Studio operations`

### Task 6: Version, Documentation, and Evidence

**Files:**
- Modify: `runtime/extension/manifest.json`
- Modify: `runtime/extension/tests/manifest.test.js`
- Modify: `runtime/extension/README.md`
- Modify: `docs/evidence/2026-07-29-provider-runtime-evidence.md`

- [ ] **Step 1: Make version tests require 0.6.0**

Run manifest tests and confirm they fail at 0.5.3.

- [ ] **Step 2: Synchronize active release surfaces**

Set manifest and README to 0.6.0. Document Edge Stable, profile doctor classifications, lifecycle titles, inline confirmation, repair behavior, and persistence boundaries.

- [ ] **Step 3: Record sanitized evidence**

Record only profile directory/display name, extension version/path-match status, lifecycle timing classes, test counts, and live route results. Do not record account identifiers, cookies, provider conversation bodies, Resume, or JD.

- [ ] **Step 4: Run documentation and manifest checks**

Run manifest tests, encoding scan, secret scan, and `git diff --check`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `docs: release PMIA operational runtime 0.6`

### Task 7: Exact Release Verification and Integration

- [ ] Run `npm test`, `npm run validate`, and `runtime/Validate_Extension_Runtime.ps1` on the exact commit.
- [ ] Point the existing unpacked-extension compatibility junction at the 0.6 worktree and reload only PMIA in Edge Stable.
- [ ] Verify Studio preflight, profile persistence, inline confirmation, wrong-profile diagnosis, extension-disabled diagnosis, repair action, and control cleanup.
- [ ] Run ChatGPT-to-ChatGPT, ChatGPT-to-Claude, Claude-to-ChatGPT, and Claude-to-Claude with unique markers; require one exact prompt and one exact acknowledgement.
- [ ] Fast-forward `main`, push `main` and `feature/runtime-0.6-operations`, and tag `pmia-runtime-v0.6.0`.
- [ ] Repoint the compatibility junction to canonical `main`, reload PMIA, and confirm Edge reports 0.6.0.
- [ ] Delete only 0.6 test logs, test exports, temporary windows, and the merged worktree. Keep the compatibility junction and every legacy file.
- [ ] Verify local/remote refs match, repository is clean, no test processes remain, and selected Edge profile remains logged in.
