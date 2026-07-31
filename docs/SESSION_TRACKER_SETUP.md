# Session Tracker Setup — PMIA 0.7.0

The tracker is an optional post-session learning companion for the active **Microsoft Edge Stable + Manifest V3** PMIA runtime. It does not use Edge Beta, Tampermonkey, or focus-injected review hotkeys.

## Repositories

- System source: `thomas-shelby006/product-pm-interview-assistant-instructions`
- Private session tracker: `thomas-shelby006/pm-interview-session-tracker`
- Suggested local tracker path: `C:\Users\Sundar\Documents\pm-interview-session-tracker`

Keep runtime behavior and session evidence separate. A single review must not modify the main PMIA system automatically.

## Active files

```text
runtime/Session_Tracker_End_Session.ahk
runtime/scripts/resolve-pmia-session-exports.ps1
runtime/scripts/push-session-to-tracker.ps1
runtime/scripts/init-session-tracker-repo.ps1
templates/session-tracker/review_lab_prompt.md
```

The Manifest V3 extension owns role-scoped schema 2.1 JSON/Markdown export. The launcher owns a hidden `PMIA_RUNTIME_CONTROL_V1` Windows-message bridge so the Review Studio can request export or exact-session shutdown without changing browser focus.

Schema 2.1 keeps the existing `Session:` and `Window:` headers used by the resolver. The added Summary and Session context sections are review data only; Resume, JD, avoid text, notes, and full setup content are not retained as event text.

## End-session and review flow

1. Complete the interview in one managed PMIA sender/receiver session.
2. Press `Alt+Shift+E` in the main launcher, or start `runtime/Session_Tracker_End_Session.ahk`.
3. The **PM Session Tracker — Review Studio** detects exactly one complete READY sender/receiver pair from PMIA lifecycle titles.
4. Choose **Export and Pair**. The companion requests export through the launcher control channel.
5. `resolve-pmia-session-exports.ps1` waits for one fresh sender and one fresh receiver Markdown file, validates both headers and the shared PMIA session ID, and rejects stale, malformed, duplicate, or mismatched files.
6. Fill practice/real, company, role, round, and mode. These values are not persisted by the companion.
7. Confirm the tracker path, Downloads path, and Review Lab URL. Only these operational paths/URL are saved in `%LOCALAPPDATA%\PMInterviewAssistant\review-settings.ini`.
8. Choose **Push and Open Review Lab**. The tracker repository must be clean.
9. The push script validates the PMIA role pair before writing state, pulls current `main`, allocates the next numeric session ID, creates the session branch, pushes it, and auto-merges by default.
10. After success, the companion opens the local tracker folder, copies the review prompt, opens the configured ChatGPT Review Lab URL, and can ask the launcher to close only the exact managed PMIA session.

A manual path field remains available when Edge downloads to a nonstandard directory.

## Safe dry run

Use synthetic schema 2.1-compatible Markdown exports before enabling a real tracker push:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\scripts\push-session-to-tracker.ps1 `
  -SessionType practice -Company synthetic -Role pm -Round mock -Mode verification `
  -Win1File <sender.md> -Win2File <receiver.md> `
  -TrackerRepoPath C:\Users\Sundar\Documents\pm-interview-session-tracker `
  -DryRun -DryRunOutputPath $env:TEMP\PMInterviewAssistant\tracker-dry-run `
  -ResultJsonPath $env:TEMP\PMInterviewAssistant\tracker-result.json
```

Dry run validates the sender/receiver headers and shared PMIA session ID, then creates `README.md`, `win1_sender.md`, and `win2_receiver.md` under the dry-run output. It performs no Git checkout, commit, branch, merge, push, or remote deletion.

## Failure handling

- **No complete READY pair:** start or restore one managed PMIA session before review.
- **More than one complete session:** end stale PMIA sessions so the companion cannot select the wrong evidence.
- **Launcher control channel unavailable:** keep the interview open and restart the main launcher; do not inject export/end hotkeys manually.
- **Malformed, stale, duplicate, or mismatched exports:** export again; the resolver never chooses an ambiguous pair.
- **Tracker repo dirty:** inspect and finish unrelated tracker work before pushing a new session.
- **Push failure:** inspect the structured result/error and local tracker state. The PMIA interview session remains open.
## Privacy and repository rules

- Keep the tracker repository private.
- Never store credentials, cookies, Resume/JD bodies, provider account data, or raw audio.
- Use synthetic exports for release tests.
- Review metadata is entered for the current operation; only local paths and the Review Lab URL persist.
- Auto-merge is permitted only in the private tracker repository after a successful non-dry-run push.
- A failed pair or push must not close the interview session.
- Review recurring patterns across sessions before changing PMIA behavior.

## Validation

The release gate validates:

- one exact READY session is detected;
- control messages share the launcher’s production export/end functions;
- resolver pairing rejects stale, malformed, duplicate, and mismatched exports;
- dry run performs no Git operation;
- real Windows PowerShell 5.1 Git flow works against a local bare remote;
- auto-merge updates `main` and removes the temporary remote branch;
- session numbering is allocated after pulling newer remote sessions;
- both AutoHotkey programs parse through `runtime/Validate_Extension_Runtime.ps1`.
