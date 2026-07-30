# Session Tracker Setup — PMIA 0.6.1

The tracker is an optional post-session companion for the active **Microsoft Edge Stable + Manifest V3** PMIA runtime. It does not use Edge Beta or Tampermonkey.

## Repositories

- System source: `thomas-shelby006/product-pm-interview-assistant-instructions`
- Private session tracker: `thomas-shelby006/pm-interview-session-tracker`
- Suggested local tracker path: `C:\Users\Sundar\Documents\pm-interview-session-tracker`

Keep system behavior and session evidence separate. A single session review must not modify the main PMIA system automatically.

## Active files

```text
runtime/Session_Tracker_End_Session.ahk
runtime/scripts/push-session-to-tracker.ps1
runtime/scripts/init-session-tracker-repo.ps1
templates/session-tracker/review_lab_prompt.md
```

The Manifest V3 extension already owns role-scoped JSON/Markdown export. No companion userscript is required.

## End-session flow

1. Complete the interview in one managed PMIA sender/receiver session.
2. Start `runtime/Session_Tracker_End_Session.ahk` or press `Alt+Shift+E` while it is running.
3. Choose **Export Both Windows**.
4. The helper discovers exactly one complete PMIA lifecycle-title pair, sends `Ctrl+Shift+F8` to both roles, and automatically locates the new sender/receiver Markdown files in Downloads.
5. Fill practice/real, company, role, round, and mode.
6. Choose **Push Session**. The tracker repository must be clean.
7. On success, optionally end the managed PMIA session and copy the Review Lab prompt.

Manual Browse remains available if Edge downloads to a nonstandard location.

## Safe dry run

Use synthetic files before enabling a real push:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\scripts\push-session-to-tracker.ps1 `
  -SessionType practice -Company synthetic -Role pm -Round mock -Mode verification `
  -Win1File <sender.md> -Win2File <receiver.md> `
  -TrackerRepoPath C:\Users\Sundar\Documents\pm-interview-session-tracker `
  -DryRun -DryRunOutputPath $env:TEMP\PMInterviewAssistant\tracker-dry-run
```

Dry run validates inputs and creates `README.md`, `win1_sender.md`, and `win2_receiver.md` under the dry-run output. It performs no checkout, commit, branch, merge, push, or remote deletion.

## Failure handling

- `NO_ACTIVE_PMIA_SESSION`: no complete sender/receiver pair exists.
- `AMBIGUOUS_PMIA_SESSIONS`: more than one complete PMIA session is open; close stale sessions.
- `SENDER_EXPORT_FAILED` / `RECEIVER_EXPORT_FAILED`: the matching managed window did not accept `Ctrl+Shift+F8`.
- `EXPORT_TIMEOUT`: matching role exports were not found in Downloads before the bounded timeout.
- `EXPORT_FILES_MISSING`: export again or use Browse for both Markdown files.
- `PUSH_FAILED`: inspect the tracker repository, Git authentication, and PowerShell output. The interview session remains open.

## Privacy and repository rules

- Keep the tracker repository private.
- Never store credentials, cookies, Resume/JD bodies, or provider account data.
- Use synthetic data for release tests.
- Auto-merge is permitted only in the tracker repository after a successful non-dry-run push.
- Review recurring patterns across sessions before changing PMIA behavior.
