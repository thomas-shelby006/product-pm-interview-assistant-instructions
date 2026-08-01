# PM Interview Assistant 0.7.0 — Install and Verify

## Active files

```text
Final_2_Window_Extension.ahk
Browser_Profile_Doctor.ps1
Validate_Extension_Runtime.ps1
Session_Tracker_End_Session.ahk
extension/
  manifest.json
  background.js
  content/
  dashboard/
  shared/
  tests/
scripts/
```

The older fixed launcher, Tampermonkey folders, archives, and rollback assets are inactive. Do not enable an old runtime beside the Manifest V3 extension.

## Install or update

1. Open Microsoft Edge Stable with the interview profile.
2. Open `edge://extensions`, enable Developer mode, and load `runtime/extension` as unpacked.
3. After any source update, reload the PMIA extension card and reload already-open managed PMIA tabs.
4. Start `runtime/Final_2_Window_Extension.ahk`.
5. Press `Alt+R`, select the same Edge profile, and choose **Run Preflight**.
6. Launch only when Profile Doctor reports the expected source path and version `0.7.0`.

Session Studio persists only profile, route, and layout preferences. Resume, JD, structured session fields, notes, prompts, answers, and session IDs remain in process/runtime memory.

## Live setup workflow

1. Select question-source and answer-workspace providers.
2. Enter Resume, Job Description, and optional session metadata.
3. Choose the initial layout.
4. Launch. The sender reaches READY before the receiver opens. After both providers are READY, Session Studio opens and verifies the Runtime Pilot Dashboard.
5. Boot context is sent only after all three managed windows are present.
6. Use the dashboard for live health, pause/queue/resume, selected sending, recovery, layouts, export, safe diagnostics and shutdown.
7. Press `Alt+D` to reopen/focus the dashboard without restarting providers. Use `Alt+H` for the active health check and `Alt+Shift+R` for the strongest full-route repair.

## Shortcut map

```text
Alt+R          Open Session Studio
Alt+D          Show or reopen the Runtime Pilot Dashboard
Alt+H          Check sender, receiver, and dashboard health
Alt+Shift+R    Fast-repair the current route and context
Alt+Esc        Resend current in-memory context
Alt+Delete     End the exact managed session and exit
Alt+Tab        Hide or restore managed windows
Alt+CapsLock   Cycle 3-window, sender+dashboard, receiver+dashboard, dashboard-only modes
CapsLock       Cycle layouts within the visible mode
Alt+Q          Toggle sender microphone
Alt+W          Toggle receiver scroll lock
Alt+E          Export sender and receiver records
Alt+Shift+E    Open or focus Review Studio
```


## Runtime Pilot Dashboard operations

- **Pause forwarding** keeps sender capture active, suppresses provisional preview delivery, and queues authoritative finals.
- **Resume + latest** sends the newest valid queued final through the normal sequence and provider-rendered proof path.
- **Resume only** re-enables transport without sending queued work.
- **Send selected** rejects superseded items; **Discard selected/all** changes queue state only and never edits provider conversations.
- **Check live** separates role reachability, heartbeat freshness, composer readiness, receiver generation, and sender source silence.
- **Repair runtime** requests semantic recovery, reloads an unresponsive owned tab, or reopens a missing role when a known provider URL exists. Full AHK repair remains the fallback when setup context must be restaged.
- Layout controls show three windows, sender + dashboard, receiver + dashboard, or dashboard only. Closing the dashboard alone does not stop transport.
- **Copy diagnostics** contains identifiers, health and metrics only. It excludes setup and transcript text.

## Runtime expectations

- Preview updates are disposable, coalesced, and never submit.
- ChatGPT and Claude use provider-specific authoritative final boundaries.
- Finals are sequenced and accepted once. Unavailable/paused question finals enter a bounded 20-item operator queue; boot context never enters it.
- Receiver acknowledgement requires a newly rendered matching user turn.
- A newer question supersedes older generating receiver work. After a newer queued final is proven, older retained finals are marked superseded and cannot be sent.
- Dead role registrations are replaced only after an active probe fails.
- Discard recovery does not activate a tab or focus an Edge window.
- Closing both provider tabs or ending the session removes registry, queue, pilot state, role logs, dashboard, and AHK in-memory setup context.

## Privacy and export

Active role logs use `chrome.storage.session`; they disappear with browser-session cleanup and are explicitly removed when the PMIA session ends. Service-worker startup purges legacy `pmia_log_*` records from local storage. Full setup text is never retained in role events.

`Alt+E` exports schema 2.1 JSON and Markdown for both roles. The summary includes safe session metadata, answer length, receiver delivery timing, queue/duplicate/stale counts, and timeouts. The setup event remains redacted.

## Review Studio

1. Press `Alt+Shift+E`.
2. Detect one exact READY pair.
3. Choose **Export and Pair**.
4. Verify one fresh sender and one fresh receiver Markdown file with the same session ID.
5. Use `-DryRun` before any real tracker push when validating setup changes.
6. Push/open Review Lab only after structured success.
7. End Session closes only the exact managed pair.

## One final automated gate

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

This runs the Node suite, extension JavaScript validation, main-launcher silent validation, and Review Studio silent validation. It must be run from the exact candidate tree.

## Browser release evidence

For material browser claims, use Browser Evidence Capture with synthetic context. Verify:

- all four provider routes as applicable;
- dashboard connects, refreshes, reconnects after service-worker suspension, and reports both roles;
- pause â†’ queue â†’ resume latest and selected send create one provider-rendered user turn per final;
- stale queue items become superseded rather than delivered;
- Check Live reports sender, receiver, dashboard and source-silence state;
- Fast Repair reuses context and returns both roles to READY;
- receiver recovery does not steal foreground focus;
- export files contain schema 2.1 summary and no raw setup content;
- end-session removes only the three task-created PMIA windows and clears session-only queue/log/pilot state;
- unrelated Edge tabs and the original checkout remain untouched.

## Recovery states

- `LINK OK`: both roles registered and reachable.
- `FORWARDING PAUSED`: sender observation continues but transport is suspended.
- `N FINALS QUEUED`: authoritative question finals are awaiting operator action.
- `FINAL QUEUED`: service-worker recovery pending state exists.
- `RUNTIME UNREACHABLE`: registered counterpart did not respond.
- `COMPOSER NOT READY`: runtime responds but provider composer is unavailable.
- `ROLE CONFLICT`: a healthy owner already holds the role.
- `registration_recovered`: a missing/unresponsive prior owner was safely replaced.

Use **Check Live** first. Use **Fast Repair** when a role is missing or not ready. Use extension settings only when Profile Doctor reports a path, version, or registration problem.
