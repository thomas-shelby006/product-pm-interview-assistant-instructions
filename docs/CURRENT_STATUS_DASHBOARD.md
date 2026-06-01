# Current Status Dashboard

Last updated: 2026-06-02

This is the fast-status file for continuing the PM Interview Helper setup without rereading the full history.

## Main system status

| Area | Status | Notes |
|---|---|---|
| PM Interview Helper Project | Configured in Vivaldi | Uses final custom instructions + 5 upload bundle files. |
| Edge Beta runtime | Source ready, local account access pending | Edge Beta must be signed into the account/workspace that can access the PM Interview Helper Project. |
| Main AHK runtime | Working source exists | `runtime/Final_2_Window_Fixed.ahk` is the active launcher. |
| Project URL default | Patch prepared, not applied | See `runtime/patches/project-url-default.patch`. |
| Tampermonkey bridge | Installed in Edge Beta | Active bridge should be v1.3.9. |
| Virtual scroll | Installed in Edge Beta | Active virtual-scroll should be v2.8.1-pwa. |
| Session tracker exporter | Installed in Edge Beta | Companion script v0.1.0. |
| Session tracker repo | Created and initialized | `thomas-shelby006/pm-interview-session-tracker`, private. |
| Review Lab Project | Source ready, UI setup pending | Create Project in ChatGPT UI using `docs/PM_INTERVIEW_REVIEW_LAB_PROJECT_INSTRUCTIONS.md`. |

## Key repos

Instruction/source repo:

`thomas-shelby006/product-pm-interview-assistant-instructions`

Session tracker repo:

`thomas-shelby006/pm-interview-session-tracker`

Local tracker path:

`C:\Users\Sundar\Documents\pm-interview-session-tracker`

## Current source of truth files

Use these first in a new thread:

1. `docs/CURRENT_STATUS_DASHBOARD.md`
2. `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md`
3. `docs/SESSION_TRACKER_SETUP.md`
4. `review_lab_project/README.md`
5. `runtime/patches/APPLY_PROJECT_URL_DEFAULT.md`

## Immediate non-testing tasks

1. Apply the PM Helper Project URL patch locally:
   - `runtime/patches/project-url-default.patch`
2. Create the `PM Interview Review Lab` ChatGPT Project in the UI.
3. Fix Edge Beta ChatGPT account/project access.

## Testing tasks later

1. Run a fake practice session.
2. Confirm Win1/Win2 Markdown exports.
3. Confirm session push to tracker repo.
4. Confirm main AHK closes after session push.
5. Run Review Lab on the fake session.

## What not to do yet

- Do not add JSON export.
- Do not add raw HTML fallback.
- Do not build dashboards.
- Do not auto-update PM Interview Helper from Review Lab after one session.
- Do not delete old disabled Tampermonkey scripts until the new flow works in real use.

## Current priority

Priority order:

1. Apply Project URL default patch.
2. Set up Review Lab Project.
3. Fix Edge Beta Project access.
4. Then run smoke tests.
