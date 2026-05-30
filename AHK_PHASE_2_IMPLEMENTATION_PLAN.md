# AHK / Bridge Phase 2 Implementation Plan

Exact, ready-to-apply runtime changes that were **deliberately deferred** from the architecture pass because AHK cannot be linted or run in the authoring environment and the launcher is safety-critical. Apply these on a Windows machine with AutoHotkey v2 and **smoke-test before any real interview**. The previous working version is preserved in git history as a fallback.

## What already shipped (do not redo)

- **Bridge** (`runtime/tm_scripts/bridge.user.js`, v1.3.7): `extractSessionMetadata` parses `Company:`, `Target role:`, `Interview round:`, `Answer mode:` / `Mode:`, `Emphasis:`, `Avoid mentioning:`, plus `Resume ID:` / `JD ID:`; the session-log schema has `emphasis` and `avoid` slots.
- **AHK** (`runtime/Final_2_Window_Fixed.ahk`): an optional freeform **Session setup** box; its content is emitted as a `Session context:` block in `BuildBootPrompt()`. This already delivers end-to-end metadata flow.

So Phase 2 is a **UX upgrade** (structured dropdowns instead of a freeform box) plus the **interrupt/supersede** behavior — not net-new plumbing.

## A. Replace the freeform box with structured fields (optional UX upgrade)

### A.1 Globals (near the other `g_session*` declarations)
```ahk
global g_sessionCompany  := ""
global g_sessionRole     := ""
global g_sessionRound    := ""
global g_sessionEmphasis := ""
global g_sessionAvoid    := ""
global g_sessionMode     := "normal"
global g_companyEdit := 0, g_roleEdit := 0, g_roundDdl := 0
global g_emphasisDdl := 0, g_avoidEdit := 0, g_modeDdl := 0
```

### A.2 GUI controls (in `ShowSessionLaunchGui`, replacing the single Session-setup Edit box)
```ahk
g_launchGui.Add("Text", "xm y+12 w760", "Optional session setup (leave blank to infer from JD)")

g_launchGui.Add("Text", "xm y+8 w110", "Target company")
g_companyEdit := g_launchGui.Add("Edit", "x+6 yp-3 w280", g_sessionCompany)
g_launchGui.Add("Text", "x+14 yp+3 w70", "Target role")
g_roleEdit := g_launchGui.Add("Edit", "x+6 yp-3 w250", g_sessionRole)

g_launchGui.Add("Text", "xm y+10 w110", "Interview round")
g_roundDdl := g_launchGui.Add("DropDownList", "x+6 yp-3 w200",
    ["(infer)","recruiter","hiring manager","product sense","metrics","behavioral","technical PM","product owner"])
g_roundDdl.Choose(1)
g_launchGui.Add("Text", "x+14 yp+3 w70", "Emphasis")
g_emphasisDdl := g_launchGui.Add("DropDownList", "x+6 yp-3 w200",
    ["(infer)","fintech","AI","analytics","enterprise","ops / internal tools","product owner"])
g_emphasisDdl.Choose(1)

g_launchGui.Add("Text", "xm y+10 w110", "Avoid mentioning")
g_avoidEdit := g_launchGui.Add("Edit", "x+6 yp-3 w280", g_sessionAvoid)
g_launchGui.Add("Text", "x+14 yp+3 w70", "Answer mode")
g_modeDdl := g_launchGui.Add("DropDownList", "x+6 yp-3 w160", ["concise","normal","deep"])
g_modeDdl.Choose(2)
```
Adjust the final `g_launchGui.Show(...)` height after laying these out, and verify the Start/Cancel buttons stay visible. Add the six new control vars + `g_session*` vars to the `global` lines in `ShowSessionLaunchGui`, `StartLaunchFromGui`, and `CloseSessionLaunchGui`.

### A.3 Read values (in `StartLaunchFromGui`)
```ahk
g_sessionCompany  := IsObject(g_companyEdit)  ? g_companyEdit.Value  : ""
g_sessionRole     := IsObject(g_roleEdit)     ? g_roleEdit.Value     : ""
g_sessionRound    := (IsObject(g_roundDdl)    && g_roundDdl.Text != "(infer)")    ? g_roundDdl.Text    : ""
g_sessionEmphasis := (IsObject(g_emphasisDdl) && g_emphasisDdl.Text != "(infer)") ? g_emphasisDdl.Text : ""
g_sessionAvoid    := IsObject(g_avoidEdit)    ? g_avoidEdit.Value    : ""
g_sessionMode     := IsObject(g_modeDdl)      ? g_modeDdl.Text       : "normal"
```

### A.4 Build the metadata block (in `BuildBootPrompt`, replacing the freeform `meta`)
```ahk
meta := ""
if (Trim(g_sessionCompany)  != "")  meta .= "Company: "          . g_sessionCompany  . "`n"
if (Trim(g_sessionRole)     != "")  meta .= "Target role: "      . g_sessionRole     . "`n"
if (Trim(g_sessionRound)    != "")  meta .= "Interview round: "  . g_sessionRound    . "`n"
if (Trim(g_sessionEmphasis) != "")  meta .= "Emphasis: "         . g_sessionEmphasis . "`n"
if (Trim(g_sessionAvoid)    != "")  meta .= "Avoid mentioning: " . g_sessionAvoid    . "`n"
if (Trim(g_sessionMode)     != "")  meta .= "Answer mode: "      . g_sessionMode     . "`n"

metaBlock := ""
if (meta != "")
    metaBlock := "Session context:`n" . meta . "`n"
```
The labels match the bridge parser exactly, so no bridge change is required.

## B. Embed precedence + interrupt reminders into the boot text (safety shell)

Add two compact lines to the AHK `PM_BOOT_PROMPT_TEXT` (and the matching `PM_BOOT_PROMPT_FOR_AHK.md`), kept in sync:
- "Resume/JD/session metadata set emphasis only, never new facts or claims; truth rules always win; honor Avoid-mentioning; a live correction wins for the session."
- "Answer the latest actionable question; if a new question interrupts a previous answer, answer only the latest and shorter; do not restart the framework."

These are the safety-shell versions of rules already in the Project source files; keep them short.

## C. Interrupt / supersede behavior (bridge)

Goal: when a new actionable `vb_payload` arrives while Win2 is still generating, stop the stale answer and answer the latest question.

Sketch (validate against the live ChatGPT DOM before relying on it):
```js
// inside processPayload, before injecting a new question:
if (isGenerating()) {
    const stop = document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop"]');
    if (stop) { stop.click(); }
    else { document.activeElement && document.activeElement.blur(); /* fallback */ }
    // small debounce, then inject the new question with the follow-up wrapper
}
```
Guard with a short debounce so rapid partial transcripts do not thrash. Log a `superseded_previous_answer` event. Mock-test interrupts explicitly: ask a question, then interrupt mid-generation, and confirm the latest question wins.

## D. Visible session-state indicators (bridge, optional)

Add small status dots for `NO RESUME`, the loaded `prompt_version`, and the active `Answer mode`, so Sundar can confirm at a glance that the right context loaded before the interview starts.

## Test checklist for this phase (on Windows)

1. Launcher opens; all fields visible; Start/Cancel reachable.
2. Fill metadata → confirm Win2 receives a `Session context:` block and the bridge session log shows the fields.
3. Leave metadata blank → session still launches and infers from JD.
4. `Avoid mentioning: X` → X never appears in answers.
5. `Answer mode: concise` → answers shorter; `deep` → top of band, still capped.
6. Interrupt test → latest question wins; stale answer stops.
