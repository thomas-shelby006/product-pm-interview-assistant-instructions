# PM Interview Assistant 0.11.0

This repository is the only editable and deployed PMIA application source on this machine.

## Current runtime

- `runtime/extension/` is the Microsoft Edge Manifest V3 extension loaded as an unpacked extension.
- `runtime/Final_2_Window_Extension.ahk` launches and arranges the sender, receiver, and Runtime Pilot Dashboard.
- `runtime/Session_Tracker_End_Session.ahk` exports a completed session and writes it to the private tracker under `.local/session-tracker`.
- `project_source_files/` contains the canonical interview-answer knowledge sources.
- `project_upload_bundle/` contains the curated files uploaded to the ChatGPT Project.
- `review_lab_project/` contains the current post-session review instructions.

## Operating model

The sender content runtime observes provisional transcript text and authoritative final questions. Provisional text is disposable. Each authoritative final is persisted through the service worker before the sender releases ownership. The receiver maintains an immutable active batch and a mutable next batch. It submits only when policy allows and considers a delivery successful only after a matching provider-rendered user turn appears.

The Runtime Pilot Dashboard reads the same authoritative state used by the service worker and content runtimes. Pause, catch-up, selected send, submit-now, repair, archive, diagnostics, and shutdown all use shared commands rather than independent UI-only state.

## Start

1. Open `edge://extensions` in Microsoft Edge.
2. Enable Developer mode.
3. Load `runtime/extension` as an unpacked extension, or select Reload after source changes.
4. Run `runtime/Final_2_Window_Extension.ahk`.
5. In Session Studio, select the Edge profile and run Preflight.
6. Launch only when PMIA 0.11.0 is registered from the expected repository path.

## Verify

Run from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

This runs the complete Node test suite, JavaScript reachability validation, and AutoHotkey validation.

## Private local data

`.local/` is intentionally ignored by Git. The private session tracker lives at `.local/session-tracker`. Resume, job description, notes, prompts, answers, and active session state are not committed to the application repository.

## Technical guide

Open `docs/PMIA_0.11.0_RELEASE_AND_ANALYTICS_REPORT.html` for the current 0.11.0 feature, analytics, transport, deployment, verification, and operating report. `docs/PMIA_CURRENT_SYSTEM_TECHNICAL_GUIDE.html` remains the 0.10.4 architecture baseline.
