# Current Setup Handoff and Requirements Ledger

Last updated: 2026-06-01

This file is the durable handoff for the PM Interview Helper system and its session-tracker improvements. Use it when starting a new ChatGPT/Kiro/Codex thread.

Tracking issue for remaining local-only work:

- https://github.com/thomas-shelby006/product-pm-interview-assistant-instructions/issues/7

## 1. Current goal

Build and operate a PM interview assistant that can:

1. run live/practice PM interview support in a two-window ChatGPT setup,
2. answer naturally and safely using Sundar's PM-positioned work history,
3. separate live/practice answering from post-session review,
4. track practice/mock and real sessions in a private GitHub tracker repo,
5. use Review Lab analysis to identify patterns before changing the main PM Interview Helper system.

## 2. Current state summary

Remote-side instruction repo work is complete for the current MVP. Remaining work requires Sundar's local machine, browser, or a GitHub repo-creation action that is not available through the current connector.

Completed remotely:

- Project bundle and custom instructions are finalized.
- Vivaldi Project setup has already been completed by Codex.
- Runtime/source files for Edge Beta are in the instruction repo.
- Session tracker MVP files are in the instruction repo.
- Review Lab instructions and prompt are refined.
- Handoff and requirements ledger exists.
- GitHub issue #7 tracks the remaining local-only setup and smoke test.

Not completed remotely:

- Creating the new private GitHub repo `pm-interview-session-tracker` because the connector has no create-repository action.
- Local Edge Beta account/project access fix.
- Tampermonkey/AHK/PowerShell smoke testing.
- Creating the ChatGPT `PM Interview Review Lab` Project in the UI.

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

Required private repo:

`pm-interview-session-tracker`

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

- Repo does not exist yet under `thomas-shelby006/pm-interview-session-tracker` as of this update.
- Sundar must create it manually in GitHub, private, then clone locally.

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
2. Use Alt+R to launch the two-window session.
3. Win1 opens as sender/transcription side.
4. Win2 opens as receiver/answer side.
5. Bridge sends the actionable interviewer question from Win1 to Win2.
6. Win2 answers through the ChatGPT Project context if Edge Beta is signed into the correct account/workspace.

Important existing behavior:

- Main AHK uses Alt+Tab override while running to hide/unhide assistant windows.
- Main AHK safe exit hotkey is Alt+Delete.
- Normal Alt+Tab is restored only after main AHK exits.

## 7. Session tracker MVP

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

## 8. Session tracker files in instruction repo

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
- Implemented in companion helper as an enabled-by-default checkbox:
  - `After successful push, close the main PM Interview AHK runtime`
- It sends the main runtime's Alt+Delete safe exit hotkey rather than killing AutoHotkey processes.

## 9. Review Lab

Separate ChatGPT Project:

`PM Interview Review Lab`

Instructions:

- `docs/PM_INTERVIEW_REVIEW_LAB_PROJECT_INSTRUCTIONS.md`

Prompt template:

- `templates/session-tracker/review_lab_prompt.md`

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

## 10. Requirements ledger

| ID | Requirement / idea | Status | Accepted solution | Tradeoff |
|---|---|---|---|---|
| R1 | Optimize ChatGPT Project for Plus file limits | Done | 5-file `project_upload_bundle/00-04` + compact custom instructions | Less granular source files, but easier Project setup |
| R2 | Use Vivaldi for Project setup | Done | Project configured in Vivaldi with 5 files | Edge Beta still needs correct account for Project access |
| R3 | Use Edge Beta for live runtime | Done / needs final Project account fix | AHK points to Edge Beta; Tampermonkey scripts installed | Edge Beta must use Plus account/workspace to see Project |
| R4 | Archive old runtime before replacing scripts | Done | Archive under repo `archive/` and old Tampermonkey scripts disabled | More repo history, but safer rollback |
| R5 | Improve `Why fintech?` answer | Done | Prepared Pemo-first answer added to story bank and Project | More specific but still truth-safe |
| R6 | Track interview sessions | Implemented MVP / needs local smoke test | Separate private tracker repo with two Markdown files per session | Minimal files, no combined Q&A yet |
| R7 | Keep practice and real sessions separate | Accepted / implemented in tracker design | top-level `practice/` and `real/` folders | Separate numbering, slightly more structure |
| R8 | ChatGPT should review sessions, not Sundar | Accepted / Review Lab designed | Separate Review Lab Project reads two files | Requires Project/repo access or file upload |
| R9 | Store blocked words/events | Accepted | Store blocked/ignored events inside the relevant Win1/Win2 file | No separate blocked tracker, simpler MVP |
| R10 | Avoid overcomplex multi-file export | Accepted | Exactly `win1_sender.md` and `win2_receiver.md` per session | Less machine-queryable than JSON, but better for ChatGPT review |
| R11 | Push sessions to GitHub after interview | Accepted / implemented locally | PowerShell script pushes/auto-merges tracker repo branch | Requires local Git auth and clean tracker repo |
| R12 | Do not put GitHub tokens in browser scripts | Accepted | Browser exports only; local script pushes | Slightly less automatic, much safer |
| R13 | Open analysis/review flow after session | Partially implemented | Companion AHK copies Review Lab prompt | Fully automatic file upload not implemented |
| R14 | Close first/main AHK after session completion | Done / needs local test | Companion sends Alt+Delete after successful push | Depends on main runtime accepting Alt+Delete while focused |
| R15 | Handoff file for new chats | Done | This file | Must be kept updated after durable changes |
| R16 | Track local-only remaining setup in GitHub | Done | Issue #7 | Keeps remaining work visible while local machine access is unavailable |

## 11. Active issues / needs testing

1. Edge Beta Project access
   - Edge Beta previously did not show `PM Interview Helper` because it used a different/non-Plus account.
   - Fix: sign into the same ChatGPT account/workspace or recreate Project in Edge Beta account.

2. Create private tracker repo
   - Required repo: `pm-interview-session-tracker`.
   - Current connector cannot create repositories.
   - Create it manually as private, then clone to `C:\Users\Sundar\Documents\pm-interview-session-tracker`.

3. Session exporter local test
   - Need to install/enable `session-tracker-export.user.js` in Edge Beta Tampermonkey.
   - Test Ctrl+Shift+F9 in Win1 and Win2.
   - Confirm files download and contain meaningful events/visible messages.

4. Companion AHK local test
   - Run `runtime/Session_Tracker_End_Session.ahk`.
   - Press Alt+Shift+E.
   - Test Export Both Windows.
   - Test selecting files and pushing to tracker repo.

5. Push script local test
   - Create/clone private tracker repo.
   - Run init script.
   - Commit/push initial tracker structure.
   - Push fake practice smoke session.

6. Close-main-runtime behavior
   - After a successful fake push, confirm the main runtime exits and normal Alt+Tab returns.
   - If Alt+Delete is not received by main AHK, future fix: add a named IPC/flag file or window-message-based close.

7. Review Lab setup
   - Create `PM Interview Review Lab` Project.
   - Use `docs/PM_INTERVIEW_REVIEW_LAB_PROJECT_INSTRUCTIONS.md` as instructions.
   - Use `templates/session-tracker/review_lab_prompt.md` as prompt.

## 12. What not to do yet

- Do not add JSON export unless Markdown becomes limiting.
- Do not add raw HTML fallback unless DOM/log capture misses important content.
- Do not build dashboards yet.
- Do not auto-update PM Interview Helper from Review Lab.
- Do not merge tracker sessions into the instruction repo.
- Do not delete old disabled Tampermonkey scripts until the new setup has passed real use.
- Do not change `Final_2_Window_Fixed.ahk` unless the companion AHK approach fails.

## 13. Recommended next steps

1. Fix Edge Beta ChatGPT account/project access.
2. Create private `pm-interview-session-tracker` repo.
3. Clone it locally.
4. Run tracker init script and push initial structure.
5. Install `session-tracker-export.user.js` in Edge Beta Tampermonkey.
6. Run one fake practice smoke session.
7. Confirm session files land in tracker repo.
8. Confirm main runtime closes after successful push.
9. Create/use Review Lab to analyze the smoke session.
10. Use the system for 2-3 practice/mock sessions before changing the main PM Interview Helper again.

## 14. New-chat bootstrap prompt

Use this in a new chat:

```text
We are continuing the PM Interview Helper system from the repo `thomas-shelby006/product-pm-interview-assistant-instructions`. First read `docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md` and issue #7. Treat them as the source of truth for current setup, accepted decisions, active files, active issues, tradeoffs, and next steps. Do not restart from scratch. Help me continue from the next active issue.
```
