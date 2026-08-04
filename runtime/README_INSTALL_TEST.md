# PM Interview Assistant 0.10.4 — Install and Verify

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
6. Launch only when Profile Doctor reports the expected source path and version `0.10.4`.

Session Studio persists only profile, route, and layout preferences. Resume, JD, structured session fields, notes, prompts, answers, and session IDs remain in process/runtime memory.

## Live setup workflow

1. Select question-source and answer-workspace providers.
2. Enter Resume, Job Description, and optional session metadata.
3. Choose the initial layout.
4. Launch. The sender reaches READY before the receiver opens. After both providers are READY, Session Studio opens and verifies the Runtime Pilot Dashboard.
5. Boot context is sent only after all three managed windows are present.
6. Use the dashboard for Live Inbox health, pause/catch-up, selected submission, auto-submit, hold, submit-now, explicit interrupt, archive, recovery, layouts, export, safe diagnostics and shutdown.
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

- **Pause forwarding** keeps sender capture active, suppresses provisional preview delivery, and persists every authoritative final in the lossless ledger.
- **Resume & Catch Up** reconciles every unresolved final in sequence order. It never selects only the newest final.
- **Resume only** re-enables normal transport without forcing the current inbox to submit.
- **Submit selected** sends one pending or failed ledger item through the normal batch and provider-rendered proof path.
- **Auto-submit** controls whether an idle receiver submits its next protected draft automatically.
- **Hold after answer** keeps accumulated questions staged after the active answer finishes.
- **Submit next draft now** submits the complete accumulated batch when Window 2 is idle.
- **Interrupt for latest** is the only normal operation allowed to stop the current Window 2 generation. It submits only the newest waiting final and leaves every earlier waiting final protected.
- **Archive selected/proven/unresolved** is explicit removal from the delivery workflow; destructive archive actions require confirmation and remain represented in session history.
- **Copy latest question** copies only the latest final text for operator use.
- **Check live** separates role reachability, heartbeat freshness, composer readiness, receiver generation, sender source silence, draft conflict and storage pressure.
- **Repair runtime** requests semantic recovery, reloads an unresponsive owned tab, or reopens a missing role when a known provider URL exists. Full AHK repair remains the fallback when setup context must be restaged.
- Layout controls show three windows, sender + dashboard, receiver + dashboard, or dashboard only. Closing the dashboard alone does not stop transport.
- **Copy diagnostics** contains identifiers, health and metrics only. It excludes setup and transcript text.

## Runtime expectations

- Preview updates are disposable, coalesced, and never enter the lossless ledger or submit.
- Every authoritative question final first enters the sender outbox. Window 1 removes its copy only after the service worker returns `persisted: true`.
- The session ledger retains every non-duplicate final without count eviction. Unavailable, paused, busy-receiver and failed items remain unresolved.
- Window 2 owns one immutable active batch and one mutable next batch. New finals arriving during generation update the next composer draft without stopping or mutating the active answer.
- A single waiting question is submitted unchanged. When multiple questions accumulate, every question remains in the submitted text and the latest is marked `HIGHEST PRIORITY`.
- A batch is proven only after a newly rendered matching provider user turn appears. One rendered batch proof maps to every frozen member ID.
- Duplicate identity is acknowledged without resubmission. A newer proven final never supersedes or deletes an older unresolved final.
- Receiver/service-worker restart reconciliation checks existing rendered batches before replaying unresolved finals in sequence order.
- Storage pressure is reported at 70%, 85% and 95%. Automatic compaction touches proven history only; unresolved finals remain protected.
- Dead role registrations are replaced only after an active probe fails.
- Recovery and dashboard operations do not activate a provider tab or focus an Edge window.
- Closing both provider tabs or ending the session removes registry, sender outbox, lossless ledger, batch state, Pilot state, role logs, dashboard, and AHK in-memory setup context.

## Privacy and export

Active role logs use `chrome.storage.session`; they disappear with browser-session cleanup and are explicitly removed when the PMIA session ends. Service-worker startup purges legacy `pmia_log_*` records from local storage. Full setup text is never retained in role events.

`Alt+E` exports schema 2.1 JSON and Markdown for both roles. The summary includes safe session metadata, answer length, receiver delivery timing, ledger/batch counts, duplicate acknowledgements, explicit archives, Pace Guard evidence, and timeouts. The setup event remains redacted.

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

For material browser claims, use an isolated Edge profile with synthetic context and keep the user?s normal browser windows untouched. Verify:

- all applicable sender/receiver provider routes;
- dashboard connect, refresh, reconnect after service-worker suspension, and exact sender/receiver registration;
- one-at-a-time final delivery with provider-rendered proof;
- multiple finals arriving while Window 2 generates remain visible in the next composer draft without interrupting the active answer;
- the eventual multi-question submission preserves every question and marks the latest as highest priority;
- every non-duplicate member ID reaches proven state, with zero unexplained missing ledger entries;
- duplicate replay does not create another provider user turn;
- Pause, Resume & Catch Up, Submit Selected, Hold, Submit Now and explicit Interrupt Latest use the same authoritative state;
- Live Inbox, Current Answer, Next Draft, Pace Guard, latency rail and storage pressure render without horizontal overflow;
- Check Live reports sender, receiver, dashboard and source-silence state;
- Fast Repair reuses context and returns both roles to READY;
- receiver recovery and all background validation avoid foreground focus changes;
- export files contain schema 2.1 summary and no raw setup content;
- end-session removes only the three task-created PMIA windows and clears session-only ledger/log/Pilot state;
- unrelated Edge tabs and the original checkout remain untouched.

## Recovery states

- `LINK OK`: both roles registered and reachable.
- `FORWARDING PAUSED`: sender observation continues but transport is suspended.
- `N FINALS PERSISTED`: unresolved authoritative finals are protected in the lossless inbox.
- `FINAL PERSISTED`: the final is durably owned but not yet proven in Window 2.
- `RUNTIME UNREACHABLE`: registered counterpart did not respond.
- `COMPOSER NOT READY`: runtime responds but provider composer is unavailable.
- `ROLE CONFLICT`: a healthy owner already holds the role.
- `registration_recovered`: a missing/unresponsive prior owner was safely replaced.

Use **Check Live** first. Use **Fast Repair** when a role is missing or not ready. Use extension settings only when Profile Doctor reports a path, version, or registration problem.


## New live safety surfaces

The Runtime Pilot now includes grouped diagnostics, Operation Guard, Gap Watch, Sender Outbox Retry, Batch Proof Inspector, Memory Guard, Interview Readiness, Runtime Efficiency, and Recovery Progress.

Before an interview, the Readiness Gate must show **Ready**. A merely open tab is not sufficient. During operation:

- Gap Watch means later finals are protected while a missing sequence is recovered.
- Sender Outbox means Window 1 still owns one or more finals pending durable acknowledgement.
- Memory Guard never compacts unresolved final text; Compact Proven affects transient/proven history only.
- Recovery remains Repairing until all six semantic checks pass.
- `G` copies a Safe Health Report. `D` retains the lower-level safe diagnostics export.
