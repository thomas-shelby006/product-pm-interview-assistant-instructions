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
4. Launch. The sender must reach READY before the receiver opens; both must reach READY before boot context is sent.
5. During a session, press `Alt+H` or choose **Check Live** to run the real counterpart preflight in both managed windows.
6. Press `Alt+Shift+R` or choose **Fast Repair** to relaunch the same route with current in-memory context.

## Shortcut map

```text
Alt+R          Open Session Studio
Alt+H          Check the live sender/receiver link
Alt+Shift+R    Fast-repair the current route and context
Alt+Esc        Resend current in-memory context
Alt+Delete     End the exact managed session and exit
Alt+Tab        Hide or restore managed windows
Alt+CapsLock   Cycle two-window, sender-only, receiver-only modes
CapsLock       Cycle layouts within the visible mode
Alt+Q          Toggle sender microphone
Alt+W          Toggle receiver scroll lock
Alt+E          Export sender and receiver records
Alt+Shift+E    Open or focus Review Studio
```

## Runtime expectations

- Preview updates are disposable, coalesced, and never submit.
- ChatGPT and Claude use provider-specific authoritative final boundaries.
- Finals are sequenced and accepted once; only the latest unavailable final is retained.
- Receiver acknowledgement requires a newly rendered matching user turn.
- A newer question supersedes older generating receiver work.
- Dead role registrations are replaced only after an active probe fails.
- Discard recovery does not activate a tab or focus an Edge window.
- Closing the final managed tab removes complete session registry/log state.

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
- Check Live reports the linked pair;
- Fast Repair reuses context and returns both roles to READY;
- receiver recovery does not steal foreground focus;
- export files contain schema 2.1 summary and no raw setup content;
- end-session removes only task-created PMIA windows;
- unrelated Edge tabs and the original checkout remain untouched.

## Recovery states

- `LINK OK`: both roles registered and reachable.
- `FINAL QUEUED`: latest final retained for recovery.
- `RUNTIME UNREACHABLE`: registered counterpart did not respond.
- `COMPOSER NOT READY`: runtime responds but provider composer is unavailable.
- `ROLE CONFLICT`: a healthy owner already holds the role.
- `registration_recovered`: a missing/unresponsive prior owner was safely replaced.

Use **Check Live** first. Use **Fast Repair** when a role is missing or not ready. Use extension settings only when Profile Doctor reports a path, version, or registration problem.
