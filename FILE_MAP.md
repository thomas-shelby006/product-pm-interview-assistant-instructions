# File Map

## Active system

- `runtime/Final_2_Window_Extension.ahk` — active AutoHotkey v2 Session Studio, managed-window launcher, layout controller, live health check, fast repair, and PM shortcut host.
- `runtime/extension/` — authoritative Manifest V3 runtime for ChatGPT and Claude.
  - `background.js` — registration, delivery, recovery, ephemeral session logs, cleanup, preflight, and browser-command export.
  - `content/entry.js` — provider runtime orchestration, sender/receiver behavior, health UI, answer capture, and export.
  - `content/adapters/` — provider-specific DOM behavior.
  - `content/signals/` — Claude native-voice signal bridge.
  - `content/senders/` — authoritative sender-turn tracking.
  - `shared/` — protocol, sequencing, preview, delivery, session registry/status/control, safe context parsing, log storage, summaries, and cleanup.
  - `tests/` — Node regression and integration tests.
- `runtime/Browser_Profile_Doctor.ps1` — verifies the selected Edge Stable profile, extension path, and version.
- `runtime/Validate_Extension_Runtime.ps1` — complete silent verification gate.
- `runtime/Session_Tracker_End_Session.ahk` — optional post-session Review Studio.
- `runtime/scripts/` — exact export pairing and private tracker push scripts.

## ChatGPT Project material

- `CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md` — compact always-on Project contract.
- `project_upload_bundle/` — recommended five-file Project upload set.
- `project_source_files/` — detailed editable source/reference material; do not upload beside the condensed bundle.
- `drafts/` — unconfirmed story and claim-safety work; never upload until reviewed and promoted.

## Operational documentation

- `README.md` — current system overview.
- `AI_SYSTEM_CONTEXT.md` — complete active-system context for an AI reviewer.
- `docs/CURRENT_STATUS_DASHBOARD.md` — current release status.
- `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md` — binding setup and safety ledger.
- `runtime/README_INSTALL_TEST.md` — installation, shortcuts, recovery, and release verification.
- `docs/SESSION_TRACKER_SETUP.md` — review-loop setup.
- `docs/evidence/` — historical verified release records.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design and implementation records.

## Preserved inactive material

- `runtime/Final_2_Window_Fixed.ahk`, `runtime/tm_scripts/`, `runtime/tm_update_support/`, and `archive/` are rollback/history assets only.
- Do not enable or modify them as part of the active Edge Stable/Manifest V3 setup unless a rollback is explicitly requested.
