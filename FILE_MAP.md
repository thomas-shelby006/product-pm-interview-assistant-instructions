# PMIA 0.10.4 File Map

## Current application

- `runtime/extension/manifest.json` — Manifest V3 entry point, permissions, content scripts, service worker, and command declaration.
- `runtime/extension/background.js` — service-worker composition root and central event owner.
- `runtime/extension/content/` — provider observation, sender ownership, receiver batching, proof, recovery, and status UI.
- `runtime/extension/shared/` — schemas, policies, state machines, ledgers, transport contracts, and reusable models.
- `runtime/extension/dashboard/` — Runtime Pilot Dashboard UI and view models.
- `runtime/extension/tests/` — current behavior and regression tests.
- `runtime/Final_2_Window_Extension.ahk` — Session Studio, browser launch, window layout, lifecycle control, and hotkeys.
- `runtime/PMIA_Runtime_Platform.ahk` — safe browser/process/window primitives.
- `runtime/Browser_Profile_Doctor.ps1` — read-only Edge profile and unpacked-extension verification.
- `runtime/Validate_Extension_Runtime.ps1` — complete local verification entry point.
- `runtime/Session_Tracker_End_Session.ahk` — Review Studio and private tracker workflow.
- `runtime/scripts/` — current export, tracker, release-evidence, isolated-smoke, and worktree-verification helpers.

## Knowledge and review sources

- `project_source_files/` — canonical interview behavior and truth sources.
- `project_upload_bundle/` — curated upload bundle for the ChatGPT Project.
- `review_lab_project/` — current post-session review project instructions.
- `templates/` — session and export templates.

## Local private state

- `.local/session-tracker/` — private practice and real-session exports. Ignored by Git.

## Documentation

- `README.md` — current operating summary.
- `DEPLOYMENT_GUIDE.md` — direct-source installation and update process.
- `docs/SESSION_TRACKER_SETUP.md` — tracker and Review Studio setup.
- `docs/PM_INTERVIEW_REVIEW_LAB_PROJECT_INSTRUCTIONS.md` — review workflow.
- `docs/PMIA_CURRENT_SYSTEM_TECHNICAL_GUIDE.html` — full current-system technical manual.
- `docs/PMIA_CURRENT_SYSTEM_INVENTORY.json` — final machine state and cleanup findings.
