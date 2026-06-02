# Current Setup Handoff and Requirements Ledger

Last updated: 2026-06-02

This file is the durable handoff for the PM Interview Helper system and its session-tracker improvements. Use it when starting a new ChatGPT/Kiro/Codex thread.

Tracking issue for remaining local testing/work:

- https://github.com/thomas-shelby006/product-pm-interview-assistant-instructions/issues/7

## 1. Current goal

Build and operate a PM interview assistant that can:

1. run live/practice PM interview support in a two-window ChatGPT setup,
2. answer naturally and safely using Sundar's PM-positioned work history,
3. separate live/practice answering from post-session review,
4. track practice/mock and real sessions in a private GitHub tracker repo,
5. use Review Lab analysis to identify patterns before changing the main PM Interview Helper system.

## 2. Current state summary

Remote/source setup for the current MVP is complete. The remaining work is local account access and smoke testing.

Completed:

- `PM Interview Helper` Project is configured in Vivaldi with custom instructions and the 5-file upload bundle.
- Edge Beta runtime source files are in the instruction repo.
- Main AHK runtime now has the PM Interview Helper Project URL default applied.
- Session tracker MVP files are in the instruction repo.
- Private tracker repo exists and is initialized: `thomas-shelby006/pm-interview-session-tracker`.
- ChatGPT `PM Interview Review Lab` Project is recorded as created/configured.
- Review Lab instructions and prompt are refined.
- Handoff, dashboard, setup docs, and issue #7 exist.

Still needs local confirmation/testing:

- Edge Beta must be signed into the ChatGPT account/workspace that can access `PM Interview Helper`.
- Fake practice smoke test must verify Win1/Win2 export, tracker push, and main-AHK close behavior.
- Review Lab should be used on the fake session.

## 3. Repositories

### Instruction/source repo

`thomas-shelby006/product-pm-interview-assistant-instructions`

Purpose:

- ChatGPT Project instructions
- Project upload bundle
- runtime scripts
- setup docs
- session-tracker MVP source

Rule:

- Do not auto-update this repo from one session review.
- System changes should be human-reviewed and pattern-based.

### Session tracker repo

`thomas-shelby006/pm-interview-session-tracker`

Suggested local path:

`C:\Users\Sundar\Documents\pm-interview-session-tracker`

Purpose:

- append-only practice/real session logs
- Review Lab outputs
- recurring patterns
- system update candidates

Rule:

- Auto-merge is acceptable here because it stores session data, not behavior/source instructions.

Current status:

- Repo exists.
- Repo is private.
- Initial structure is pushed.
- Local path reported by Codex: `C:\Users\Sundar\Documents\pm-interview-session-tracker`.

## 4. Apps and environments involved

### Vivaldi

Use:

- ChatGPT Project setup and normal Project editing.

Current Project:

- `PM Interview Helper`

Status:

- configured with custom instructions and 5 upload bundle files.

### Microsoft Edge Beta

Use:

- live two-window runtime.

Important account issue:

- Edge Beta previously had a non-Plus/different ChatGPT account and could not see `PM Interview Helper`.
- To use Project context in runtime, Edge Beta must sign into the same ChatGPT account/workspace that owns the Project or recreate the Project there.

### Tampermonkey in Edge Beta

Active scripts should be:

- `ChatGPT PM Interview Bridge (2-Window)` v1.3.9
- `ChatGPT Virtual Scroll (PWA Scroll-Relative Fix)` v2.8.1-pwa
- `ChatGPT PM Session Tracker Export` v0.1.0

Old scripts should stay disabled, not deleted until stable.

### AutoHotkey v2

Main runtime:

- `runtime/Final_2_Window_Fixed.ahk`

Companion end-session helper:

- `runtime/Session_Tracker_End_Session.ahk`

## 5. ChatGPT Project setup

Custom instructions file:

- `CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md`

Project upload bundle:

- `project_upload_bundle/00_PROJECT_CORE_INSTRUCTIONS.md`
- `project_upload_bundle/01_CANDIDATE_PROFILE_AND_STORY_BANK.md`
- `project_upload_bundle/02_ROUTER_METRICS_DELIVERY.md`
- `project_upload_bundle/03_SESSION_RUNTIME_AND_CONTEXT.md`
- `project_upload_bundle/04_TESTS_REVIEW_AND_MOCK_LOOP.md`

Do not upload:

- `runtime/`
- `project_source_files/`
- `drafts/`
- `archive/`
- repo docs

## 6. Runtime setup

Main runtime flow:

1. Start `runtime/Final_2_Window_Fixed.ahk`.
2. Use Alt+R to launch the Resume/JD/session-setup GUI.
3. Win1 opens as sender/transcription side.
4. Win2 opens as receiver/answer side.
5. Both windows now use the PM Interview Helper Project URL plus `vb_role=sender` / `vb_role=receiver`.
6. Bridge sends the actionable interviewer question from Win1 to Win2.
7. Win2 answers through the ChatGPT Project context if Edge Beta is signed into the correct account/workspace.

Important existing behavior:

- Main AHK uses Alt+Tab override while running to hide/unhide assistant windows.
- Main AHK safe exit hotkey is Alt+Delete.
- Normal Alt+Tab is restored only after main AHK exits.

## 7. Project URL default

Status: applied.

Commit reported by Codex:

`8023f36cf74de25e05a8c443c46f47f72eb58661`

Source behavior:

- `PM_HELPER_PROJECT_URL` points to `https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project`.
- `REVIEW_LAB_PROJECT_URL` remains blank.
- `AutoStartup()` opens Win1/Win2 through `UrlWithRole(PM_HELPER_PROJECT_URL, "sender/receiver")`.

## 8. Session tracker MVP

Accepted MVP:

- exactly two raw Markdown files per session:
  - `win1_sender.md`
  - `win2_receiver.md`
- no combined Q&A file in MVP
- no separate blocked-word file in MVP
- blocked/ignored events stay inside the relevant window file
- practice/mock and real sessions are stored separately
- ChatGPT Review Lab is the reviewer; Sundar does not manually review raw files

Tracker repo layout:

```text
practice/<session_id>/win1_sender.md
practice/<session_id>/win2_receiver.md

real/<session_id>/win1_sender.md
real/<session_id>/win2_receiver.md

reviews/
patterns/
```

Session ID format:

`0001_YYYY-MM-DD_company_role_round_mode`

Practice and real sessions have separate number sequences.

## 9. Session tracker files in instruction repo

### Exporter userscript

`runtime/tm_scripts/session-tracker-export.user.js`

Purpose:

- companion userscript
- reads existing `pm_session_log`
- exports current window as structured Markdown
- sender exports `win1_sender.md`
- receiver exports `win2_receiver.md`
- hotkey: Ctrl+Shift+F9
- also responds to localStorage key `pm_session_tracker_export_request`

Guardrail:

- no GitHub token
- no GitHub write logic
- no direct repo mutation

### Push script

`runtime/scripts/push-session-to-tracker.ps1`

Purpose:

- validates Win1/Win2 files
- validates tracker repo is clean
- creates next numbered session folder under practice/real
- copies exactly `win1_sender.md` and `win2_receiver.md`
- commits/pushes session branch
- auto-merges into tracker main
- deletes session branch if possible

Guardrail:

- uses local Git credentials only
- fails if tracker repo is dirty
- modifies tracker repo only

### Tracker init script

`runtime/scripts/init-session-tracker-repo.ps1`

Purpose:

- creates tracker folder structure:
  - practice
  - real
  - reviews
  - patterns
- adds `.gitkeep`
- adds README if missing

### Companion AHK

`runtime/Session_Tracker_End_Session.ahk`

Purpose:

- separate from main launcher
- Alt+Shift+E opens end-session panel
- can trigger export in both windows via Ctrl+Shift+F9
- lets user select exported Win1/Win2 Markdown files
- runs `push-session-to-tracker.ps1`
- can copy Review Lab prompt
- after successful push, can close the main PM Interview AHK runtime by sending Alt+Delete

Accepted close-runtime requirement:

- Once session export/push is complete, main AHK should close itself so normal Alt+Tab behavior is restored.
- Implemented in companion helper as an enabled-by-default checkbox.
- It sends the main runtime's Alt+Delete safe exit hotkey rather than killing AutoHotkey processes.

## 10. Review Lab

Separate ChatGPT Project:

`PM Interview Review Lab`

Project URL recorded:

`https://chatgpt.com/g/g-p-6a1df19f33448191b9fc968f8c9f1378/project`

Status recorded:

- Created/configured in ChatGPT.
- Instructions pasted from `docs/PM_INTERVIEW_REVIEW_LAB_PROJECT_INSTRUCTIONS.md`.
- Project source uploaded: `templates/session-tracker/review_lab_prompt.md`.

Review Lab reads exactly:

- `win1_sender.md`
- `win2_receiver.md`

Review priorities:

1. Truth safety / no fake claims
2. Direct answer to the interviewer question
3. Natural spoken delivery
4. PM framing and judgment
5. Relevant story selection
6. Length discipline
7. Company/JD alignment
8. Follow-up handling
9. Transcript/filter reliability
10. Reusable improvement candidates

It should classify update candidates as:

- session-only coaching
- repeated-pattern candidate
- urgent system fix

Do not update the main PM Interview Helper from one weak answer unless severe/truth-risky.

## 11. Requirements ledger

| ID | Requirement / idea | Status | Accepted solution | Tradeoff |
|---|---|---|---|---|
| R1 | Optimize ChatGPT Project for Plus file limits | Done | 5-file `project_upload_bundle/00-04` + compact custom instructions | Less granular source files, but easier Project setup |
| R2 | Use Vivaldi for Project setup | Done | Project configured in Vivaldi with 5 files | Edge Beta still needs correct account for Project access |
| R3 | Use Edge Beta for live runtime | Done / needs Project access confirmation | AHK points to Edge Beta; Tampermonkey scripts installed | Edge Beta must use Plus account/workspace to see Project |
| R4 | Archive old runtime before replacing scripts | Done | Archive under repo `archive/` and old Tampermonkey scripts disabled | More repo history, but safer rollback |
| R5 | Improve `Why fintech?` answer | Done | Prepared Pemo-first answer added to story bank and Project | More specific but still truth-safe |
| R6 | Track interview sessions | Implemented MVP / needs local smoke test | Separate private tracker repo with two Markdown files per session | Minimal files, no combined Q&A yet |
| R7 | Keep practice and real sessions separate | Done | top-level `practice/` and `real/` folders | Separate numbering, slightly more structure |
| R8 | ChatGPT should review sessions, not Sundar | Done | Separate Review Lab Project reads two files | Requires session files/repo path per review |
| R9 | Store blocked words/events | Done | Store blocked/ignored events inside the relevant Win1/Win2 file | No separate blocked tracker, simpler MVP |
| R10 | Avoid overcomplex multi-file export | Done | Exactly `win1_sender.md` and `win2_receiver.md` per session | Less machine-queryable than JSON, but better for ChatGPT review |
| R11 | Push sessions to GitHub after interview | Implemented / needs smoke test | PowerShell script pushes/auto-merges tracker repo branch | Requires local Git auth and clean tracker repo |
| R12 | Do not put GitHub tokens in browser scripts | Done | Browser exports only; local script pushes | Slightly less automatic, much safer |
| R13 | Open analysis/review flow after session | Partially implemented | Companion AHK copies Review Lab prompt | Fully automatic file upload not implemented |
| R14 | Close first/main AHK after session completion | Implemented / needs smoke test | Companion sends Alt+Delete after successful push | Depends on main runtime accepting Alt+Delete while focused |
| R15 | Handoff file for new chats | Done | This file | Must be kept updated after durable changes |
| R16 | Track local-only remaining setup in GitHub | Done | Issue #7 | Keeps remaining work visible |
| R17 | Open PM Helper Project URL by default in AHK | Done | `PM_HELPER_PROJECT_URL` + `UrlWithRole()` | Needs local launch confirmation later |

## 12. Active issues / needs testing

1. Edge Beta Project access
   - Edge Beta previously did not show `PM Interview Helper` because it used a different/non-Plus account.
   - Fix: sign into the same ChatGPT account/workspace or recreate Project in Edge Beta account.

2. Session exporter local test
   - `session-tracker-export.user.js` is installed/enabled per Codex setup report.
   - Test Ctrl+Shift+F9 in Win1 and Win2.
   - Confirm files download and contain meaningful events/visible messages.

3. Companion AHK local test
   - Run `runtime/Session_Tracker_End_Session.ahk`.
   - Press Alt+Shift+E.
   - Test Export Both Windows.
   - Test selecting files and pushing to tracker repo.

4. Push script local test
   - Push fake practice smoke session.
   - Confirm the session lands in the private tracker repo.

5. Close-main-runtime behavior
   - After a successful fake push, confirm the main runtime exits and normal Alt+Tab returns.
   - If Alt+Delete is not received by main AHK, future fix: add a named IPC/flag file or window-message-based close.

6. Review Lab flow
   - Use Review Lab to analyze the fake session.
   - Confirm the review format is useful before relying on it for real sessions.

## 13. What not to do yet

- Do not add JSON export unless Markdown becomes limiting.
- Do not add raw HTML fallback unless DOM/log capture misses important content.
- Do not build dashboards yet.
- Do not auto-update PM Interview Helper from Review Lab.
- Do not merge tracker sessions into the instruction repo.
- Do not delete old disabled Tampermonkey scripts until the new setup has passed real use.
- Do not change `Final_2_Window_Fixed.ahk` again unless the Project URL launch or companion AHK approach fails.

## 14. Recommended next steps

1. Fix/confirm Edge Beta ChatGPT account/project access.
2. Run one fake practice smoke session.
3. Confirm session files land in tracker repo.
4. Confirm main runtime closes after successful push.
5. Use Review Lab to analyze the smoke session.
6. Use the system for 2-3 practice/mock sessions before changing the main PM Interview Helper again.

## 15. New-chat bootstrap prompt

Use this in a new chat:

```text
We are continuing the PM Interview Helper system from the repo `thomas-shelby006/product-pm-interview-assistant-instructions`. First read `docs/CURRENT_STATUS_DASHBOARD.md`, `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md`, and issue #7. Treat them as the source of truth for current setup, accepted decisions, active files, active issues, tradeoffs, and next steps. Do not restart from scratch. Help me continue from the next active issue.
```
