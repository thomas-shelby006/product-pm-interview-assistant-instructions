# PMIA Operational Hardening 0.6.0 Design

## Goal

Turn Session Studio into the single reliable control surface for Microsoft Edge Stable, profile selection, extension readiness, provider readiness, launch, repair, and recovery while preserving the proven 0.5.3 preview/commit transport.

## Confirmed context

- Microsoft Edge Stable is the only supported runtime browser.
- The working local profile is currently Edge `Default`, displayed as `Profile 1`.
- The PMIA unpacked extension is registered in that profile and reports version 0.5.3.
- All four provider routes passed live on 0.5.3.
- Prior registration failures came from profile/extension state and ambiguous startup, not from the final transport architecture.

## Non-goals

- Do not install or remove browsers.
- Do not rewrite the provisional/final transport.
- Do not read provider cookies, tokens, private APIs, or raw audio.
- Do not persist Resume, Job Description, notes, prompts, or answers.
- Do not modify or delete legacy launchers, archives, Tampermonkey assets, or rollback files.

## Architecture

### 1. Edge Profile Doctor

Create `runtime/Browser_Profile_Doctor.ps1` as a read-only profile inspector. It accepts `-UserDataRoot`, `-ExpectedExtensionPath`, and optional `-ProfileDirectory` arguments and emits tab-separated records suitable for AutoHotkey and automated tests.

For every Edge profile with a `Preferences` file it reports:

- profile directory and display name
- PMIA extension ID, registered path, and service-worker version
- whether the registered path resolves to the canonical extension directory
- a deterministic issue code and actionable message

The doctor never edits Edge preferences. A missing or disabled runtime is resolved through the normal Edge extensions UI, not by mutating browser files.

### 2. Non-sensitive preferences

Store only these values in `%LOCALAPPDATA%\PMInterviewAssistant\settings.ini`:

- `ProfileDirectory`
- `SenderProvider`
- `ReceiverProvider`
- `LayoutMode`

Resume, Job Description, notes, session IDs, prompts, and answers remain process-memory only. Invalid saved values fall back to detected defaults.

### 3. Runtime lifecycle handshake

Managed pages use three title phases:

- `PMIA_BOOT_<ROLE>_<PROVIDER>_<SESSION>`: the content runtime loaded.
- `PMIA_REGISTERED_<ROLE>_<PROVIDER>_<SESSION>`: the service worker accepted role ownership.
- `PMIA_<ROLE>_<PROVIDER>_<SESSION>`: the provider composer exists and the tab is launch-ready.

The existing final title remains unchanged, so post-launch window management and hotkeys keep their current contract. The title defender becomes mutable and can promote or demote the lifecycle phase without creating a second observer.

This lets the launcher classify failures without cookies or DOM automation:

- no boot title: extension absent, disabled, or content script blocked
- boot only: registration failure or role conflict
- registered only: provider login/composer unavailable
- final title: ready

### 4. Session Studio state machine

The launcher uses explicit states:

`IDLE -> PREFLIGHT -> LAUNCHING -> WAITING_BOOT -> WAITING_REGISTRATION -> WAITING_COMPOSER -> READY`

Any state can enter `ERROR` with a specific issue code. Polling is condition-driven at 100 milliseconds; ready states advance immediately. The fixed 1.2-second boot delay is removed because the final title already proves composer readiness.

### 5. Session Studio interface

The Studio becomes a 960-by-780 operational dashboard with four clear regions:

1. **Runtime header** — product name, Edge Stable badge, selected profile, extension version, and health badge.
2. **Route workspace** — sender and receiver cards with provider selectors and one Swap action.
3. **Interview context** — Resume, Job Description, notes, character counts, and privacy copy.
4. **Launch dock** — live status/progress plus Preflight, Repair, Close, and the dominant Launch Interview button.

Short context no longer opens a modal. The first launch click changes the inline warning and primary button to `Launch Anyway`; a second click within ten seconds proceeds. Editing Resume or Job Description resets that confirmation.

### 6. Preflight and repair

`Run Preflight` refreshes profile discovery and reports the first blocking issue. It never launches provider windows.

`Repair Launch` reruns the doctor, closes only PMIA lifecycle windows for the current session, and retries launch when the local state is repairable. For extension registration/version/path problems it opens the selected profile's `edge://extensions` page and shows the exact required action. It never edits Edge preference files or closes unrelated windows.

After both final READY titles appear, the launcher sends the boot context immediately and triggers active counterpart preflight in both tabs.

## Error handling

Every launcher error maps to one of these stable codes:

- `EDGE_NOT_FOUND`
- `PROFILE_NOT_FOUND`
- `EXTENSION_NOT_REGISTERED`
- `EXTENSION_PATH_MISMATCH`
- `EXTENSION_VERSION_MISMATCH`
- `EXTENSION_NOT_RUNNING`
- `SENDER_REGISTRATION_FAILED`
- `RECEIVER_REGISTRATION_FAILED`
- `SENDER_COMPOSER_UNAVAILABLE`
- `RECEIVER_COMPOSER_UNAVAILABLE`
- `COUNTERPART_PREFLIGHT_FAILED`

The Studio keeps the failed state visible and offers the relevant recovery action. No blocking error dialog is used for expected operational failures.

## Testing and release gates

- Fixture-driven PowerShell tests cover profile enumeration and extension path/version classification.
- AutoHotkey launcher tests cover persistence boundaries, inline short-context confirmation, lifecycle titles, state transitions, profile arguments, repair behavior, control cleanup, and no legacy edits.
- Extension tests cover mutable lifecycle titles and READY promotion only after registration plus composer availability.
- Existing 0.5.3 transport and four-route matrix tests remain unchanged.
- Live release verification uses Edge Stable with the selected profile, checks preflight and repair, then runs all four provider routes with exact prompt and acknowledgement counts.
- The release is version 0.6.0, merged to `main`, tagged `pmia-runtime-v0.6.0`, and leaves the canonical repository clean.
