# PM Interview Assistant 0.6 - Install and Verify

## Active files

```text
Final_2_Window_Extension.ahk
Validate_Extension_Runtime.ps1
extension/
  manifest.json
  background.js
  content/
  shared/
```

The older `Final_2_Window_Fixed.ahk`, Tampermonkey folders, session-tracker helper, archives, and rollback assets are retained but inactive. Do not enable an old bridge or userscript beside the Manifest V3 runtime.

## Install the extension

1. Open Microsoft Edge Stable with the profile used for interviews.
2. Open `edge://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select `runtime/extension`.
4. Start `runtime/Final_2_Window_Extension.ahk`.
5. Press `Alt+R`, select the same Edge profile, and run **Preflight**.
6. Launch only after the profile doctor reports the expected path and version.

Resume, Job Description, notes, prompts, answers, and session identifiers are not persisted by Session Studio. Only safe profile, route, and layout preferences are stored in `%LOCALAPPDATA%\PMInterviewAssistant\settings.ini`.

## PM shortcut map

```text
Alt+R          Open Session Studio; launch or relaunch the selected route
Alt+Esc        Resend current in-memory PM context
Alt+Delete     End the exact managed session and exit AutoHotkey
Alt+Tab        Hide or restore managed interview windows
Alt+CapsLock   Cycle two-window, sender-only, receiver-only modes
CapsLock       Cycle layout presets within the visible mode
Alt+Q          Toggle sender microphone through the provider adapter
Alt+W          Toggle receiver scroll lock
Alt+E          Export sender and receiver session records
```

The active runtime does not map Alt+S, Alt+A, Alt+X, Alt+1, Alt+Z, or Alt+Shift. It contains no screenshot, Greenshot, coding, code-focus, or force-forward workflow.

## Transport expectations

- Preview growth updates the receiver composer without submitting.
- Listening, transcribing, translating, processing, and recording placeholders are ignored.
- ChatGPT commits only when the following assistant turn appears.
- Claude commits only on a human `message_complete` event.
- Claude interruption does not clear or advance the current turn; transcript-empty does.
- The receiver submits a staged final once and acknowledges success only after a matching provider user turn renders.
- A replayed final is acknowledged without another composer write or submit.
- When the receiver is unavailable, only the latest final is retained.

## Silent automated verification

Run from the repository root:

```powershell
npm test
npm run validate
powershell -NoProfile -ExecutionPolicy Bypass -File runtime\Validate_Extension_Runtime.ps1
```

The validator invokes AutoHotkey with `--validate`. This path emits `AHK_VALID` and exits before any GUI or browser launch, so it does not steal focus.

## Manual release matrix

Use uniquely named managed PMIA sessions and retain browser evidence for:

- ChatGPT -> ChatGPT
- ChatGPT -> Claude
- Claude -> ChatGPT
- Claude -> Claude
- one session minimized for more than 60 seconds before a second turn
- Alt+Delete shutdown while unrelated Edge tabs remain open

For every route, verify one sender user turn, one receiver user turn, one answer, no queued duplicate, no generating state after completion, and an empty receiver composer. Close only the task-created managed PMIA tabs.

## Recovery

- `LINK OK`: both managed roles are registered and reachable.
- `FINAL QUEUED`: the latest final is retained for receiver recovery.
- `RUNTIME UNREACHABLE` or `COMPOSER NOT READY`: use Preflight and repair the selected profile registration.
- After updating an unpacked build, reload the extension and any already-open managed PMIA tabs.
- Do not edit Edge profile preference files directly and do not remove legacy files during routine updates.