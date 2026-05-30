# PM Interview Assistant — Install and Test

## Final folder structure

```text
Final_2_Window_Fixed.ahk
README_INSTALL_TEST.md

tm_scripts/
  bridge.user.js
  virtual-scroll.user.js

tm_update_support/
  start_tm_update_server.ps1
```


## Before every test or interview

1. Open Tampermonkey Dashboard and confirm exactly two scripts are enabled:
   - `bridge.user.js`
   - `virtual-scroll.user.js`

   Disable every older bridge, older virtual-scroll, frontend/SWE script, and `focus.user.js`. Duplicate userscripts are the most likely cause of first-run failure.

2. Use the same ChatGPT Plus account in the same Edge Beta browser profile for both Win1 and Win2. The bridge uses `localStorage`, which is shared by origin and browser profile. If the two windows run in different profiles/accounts, the bridge can fail silently.

3. During live interview mode, AHK writes silent debug events to:

```text
runtime_logs/session_debug.log
```

No AHK tooltips are shown during the interview.

## How to run

1. Install AutoHotkey v2 if it is not already installed.
2. Double-click `Final_2_Window_Fixed.ahk`.
3. Press `Alt+R`.
4. Paste Resume and Job Description into the launch window.
5. Click `Start / Launch`.

The AHK file is the main runtime. Do not use a CMD launcher, PowerShell launcher, unpacked Edge extension, or extra setup script as the normal runtime. No AHK tooltips are shown during interview mode.

## Resume/JD memory behavior

- Resume/JD are stored only in the current AHK process memory.
- Pressing `Alt+R` again during the same AHK process prefills the GUI with the current Resume/JD.
- Pressing `Alt+Esc` resends the PM boot prompt with the current in-memory Resume/JD.
- Pressing `Alt+Delete` exits the current AHK process without saving Resume/JD.
- After fully exiting and restarting the AHK file, Resume/JD should be blank again.

## Tampermonkey scripts

Install or enable only these active scripts:

```text
tm_scripts/bridge.user.js
tm_scripts/virtual-scroll.user.js
```

Do not enable any old `focus.user.js` copy if it exists in Tampermonkey. It is not part of the active PM runtime.

## Tampermonkey local update support

Run the update server only when updating userscripts:

```powershell
.\tm_update_support\start_tm_update_server.ps1
```

It serves the project root at:

```text
http://127.0.0.1:8123
```

Local userscript URLs:

```text
http://127.0.0.1:8123/tm_scripts/bridge.user.js
http://127.0.0.1:8123/tm_scripts/virtual-scroll.user.js
```

The update server is not required for normal AHK runtime.

## Final shortcut map

```text
Alt+R          Resume/JD GUI + launch/relaunch Win1/Win2
Alt+Esc        Resend PM boot prompt + current Resume/JD directly to Win2
Alt+Delete     Exit/terminate AHK session; do not save Resume/JD

Alt+Tab        Hide/unhide current assistant windows
               visible → save current mode/layout and move offscreen
               hidden  → restore saved mode/layout

Alt+CapsLock   Cycle visible modes:
               1. Two-window mode
               2. Win1-only mode
               3. Win2-only mode
               back to two-window mode
               Hidden/unhidden is controlled only by Alt+Tab

CapsLock       Cycle layouts inside the current visible mode

Alt+Q          Mute/unmute Win1
Alt+W          Scroll lock/unlock Win2
Alt+S          Screenshot/context feature
Alt+E          Export session

Alt+A          Disabled in PM mode
Alt+Z          Disabled in PM mode
Alt+1          Disabled in PM mode
Alt+X          Disabled in PM mode
Alt+Backspace  Not used
```

## Manual test checklist

### Launch and context

- Double-click `Final_2_Window_Fixed.ahk`.
- Press `Alt+R`.
- Confirm the Resume/JD GUI appears.
- Paste Resume and Job Description.
- Click `Start / Launch`.
- Confirm Win1 and Win2 open in Edge Beta PWA/app mode.
- Confirm Win1 title becomes `VB_SENDER`.
- Confirm Win2 title becomes `VB_RECEIVER`.
- Confirm PM boot prompt + Resume + JD reaches Win2.
- Press `Alt+R` again during the same AHK session; confirm the GUI is prefilled with current Resume/JD.
- Press `Alt+Delete`, restart the AHK file, press `Alt+R`; confirm Resume/JD are blank.

### Hotkeys

- `Alt+Esc`: resends PM boot prompt + current Resume/JD.
- `Alt+Tab`: hides current assistant windows offscreen; pressing again restores the saved mode/layout.
- `Alt+CapsLock`: cycles two-window → Win1-only → Win2-only → two-window. Hidden/unhidden is controlled only by Alt+Tab.
- `CapsLock`: cycles layout presets within the current visible mode.
- `Alt+Q`: mutes/unmutes Win1 using the coordinate click flow and restores the previous layout/focus.
- `Alt+W`: toggles Win2 scroll lock.
- `Alt+S`: performs screenshot/context paste into Win2.
- `Alt+E`: exports the PM session from Win2.
- `Alt+A`: silent no-op in PM mode.
- `Alt+Z`: silent no-op in PM mode.
- `Alt+1`: silent no-op in PM mode.
- `Alt+X`: silent no-op in PM mode.
- `Alt+Backspace`: should do nothing because it is not mapped.

### Bridge

- Win1 transcript forwards to Win2.
- Win2 auto-scrolls to the latest answer unless scroll lock is enabled.
- Win1 silence detector shows a `SILENCE 90s` dot if no new transcript is detected for 90 seconds.
- Filler text like “ok”, “yes”, and “thanks” is ignored.
- If Win2 is generating, new transcript is queued and sent after generation ends.
- PM transcript buffer wording is used.
- No frontend/SWE/coding workflow appears in normal PM mode.
- Export JSON includes session metadata, timestamped events, Q&A pairs where available, answer word counts, `route_guess`, company anchor guess, and length flags.

### Virtual scroll

Only one virtual-scroll script should be enabled in Tampermonkey.

In DevTools, run:

```js
document.querySelectorAll('section[data-testid^="conversation-turn"]').length
```

Expected:

- Near `MAX_TURNS` at the bottom of the conversation.
- Increases when scrolling up.
- Drops again when scrolling down.

## Known risks

- ChatGPT DOM changes can affect textbox injection, title detection, screenshot paste, answer capture, or virtual-scroll detection.
- Old enabled Tampermonkey scripts can conflict. Step 1 before testing is to confirm exactly two enabled scripts: `bridge.user.js` and `virtual-scroll.user.js`.
- AutoHotkey v2 validation requires Windows. If a hotkey does not fire, try running the AHK script as administrator.
- The update server requires Python. If Python is missing, manually open the userscript files and paste them into Tampermonkey.


## Required before first test

1. Open Tampermonkey dashboard.
2. Confirm exactly two scripts are enabled:
   - bridge.user.js
   - virtual-scroll.user.js
3. Disable every old bridge, old virtual scroll, focus script, frontend/SWE script, duplicate test script, or extension fallback.
4. Use the same ChatGPT Plus account in the same Edge Beta browser profile for Win1 and Win2. Different browser profiles do not share localStorage, so the bridge can silently fail.
