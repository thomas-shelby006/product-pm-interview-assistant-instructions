# Session Tracker Setup

Use this after the PM Interview Helper two-window runtime is working. This tracker is a separate private repo for session evidence and ChatGPT Review Lab outputs.

## Repos

Instruction repo:

`product-pm-interview-assistant-instructions`

Session tracker repo:

`pm-interview-session-tracker`

Suggested local tracker path:

`C:\Users\Sundar\Documents\pm-interview-session-tracker`

Keep these separate. The instruction repo stores the system. The tracker repo stores practice/real session logs.

## Required files in the instruction repo

```text
runtime/tm_scripts/session-tracker-export.user.js
runtime/Session_Tracker_End_Session.ahk
runtime/scripts/init-session-tracker-repo.ps1
runtime/scripts/push-session-to-tracker.ps1
templates/session-tracker/review_lab_prompt.md
```

## Tracker repo structure

```text
practice/
real/
reviews/
patterns/
```

Each session contains exactly two raw files in the MVP:

```text
practice/<session_id>/win1_sender.md
practice/<session_id>/win2_receiver.md

real/<session_id>/win1_sender.md
real/<session_id>/win2_receiver.md
```

Session ID format:

`0001_YYYY-MM-DD_company_role_round_mode`

Practice and real sessions are numbered separately.

## One-time setup

1. Create a private GitHub repo named `pm-interview-session-tracker`.
2. Clone it to:
   `C:\Users\Sundar\Documents\pm-interview-session-tracker`
3. From the instruction repo, run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "runtime\scripts\init-session-tracker-repo.ps1" -TrackerRepoPath "C:\Users\Sundar\Documents\pm-interview-session-tracker"
```

4. In the tracker repo, commit and push the initial folders:

```powershell
cd "C:\Users\Sundar\Documents\pm-interview-session-tracker"
git add .
git commit -m "chore: initialize session tracker"
git push origin main
```

The push script expects the tracker repo to be clean before adding a new session.

## Edge Beta setup

Install or enable this companion userscript in Edge Beta Tampermonkey:

```text
runtime/tm_scripts/session-tracker-export.user.js
```

Keep the existing scripts enabled:

```text
ChatGPT PM Interview Bridge (2-Window)
ChatGPT Virtual Scroll (PWA Scroll-Relative Fix)
ChatGPT PM Session Tracker Export
```

There should still be exactly one active bridge script and one active virtual-scroll script. The tracker exporter is an additional companion script.

## End-session flow

1. Run the normal two-window AHK runtime.
2. Run the companion helper:

```text
runtime/Session_Tracker_End_Session.ahk
```

3. Press `Alt + Shift + E`.
4. Click `Export Both Windows`.
5. Confirm two Markdown files downloaded:
   - one with `win1_sender`
   - one with `win2_receiver`
6. Select those two files in the helper.
7. Choose session type:
   - `practice` for solo practice or friend mocks
   - `real` for real interviews / serious external interview sessions
8. Fill company, role, round, and mode.
9. Click `Push Session`.
10. After push succeeds, click `Copy Review Prompt` and use it in the `PM Interview Review Lab` Project.

## Smoke test

Use a fake practice session first:

```text
Session type: practice
Company: test
Role: pm
Round: smoke
Mode: mock
```

Expected result in tracker repo:

```text
practice/0001_<date>_test_pm_smoke_mock/win1_sender.md
practice/0001_<date>_test_pm_smoke_mock/win2_receiver.md
```

## Failure handling

If export does not download files:

- Confirm the tracker exporter userscript is enabled in Edge Beta.
- Confirm the window title is `VB_SENDER` / `VB_RECEIVER`.
- Try `Ctrl + Shift + F9` inside each window manually.

If push fails:

- Confirm the tracker repo path is correct.
- Confirm the tracker repo has a remote named `origin`.
- Confirm the tracker repo is clean: `git status`.
- Confirm GitHub auth is still using the correct account.

## Rules

- Keep the tracker repo private.
- Do not store tokens or credentials in any repo file.
- Auto-merge is acceptable only for the tracker repo.
- Do not auto-update the PM Interview Helper instruction repo from a single session review.
- Let Review Lab find patterns across multiple sessions before changing the main PM Interview Helper system.
