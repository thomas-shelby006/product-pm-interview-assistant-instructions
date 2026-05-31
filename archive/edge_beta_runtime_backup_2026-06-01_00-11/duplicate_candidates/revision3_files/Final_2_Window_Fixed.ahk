#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================
;  PM INTERVIEW ASSISTANT — 2-Window Setup (Edge Beta)
;  Win1 = Sender (Voice/Transcription)
;  Win2 = Receiver (Answer / ChatGPT)
;
;  ALT+R         = Launch / restart both windows (PWA Mode)
;  ALT+CAPSLOCK  = Cycle modes: 2-win → 1-win → hidden → 2-win
;  CAPSLOCK      = Cycle layout presets within current mode
;  ALT+TAB       = Switch focus between managed Win1/Win2 windows
;  ALT+SHIFT     = Toggle scroll lock on Win2
;  ALT+X         = Disabled in PM mode (use Alt+Shift for scroll lock)
;  ALT+ESC       = Resend boot prompt to Win1 (auto-forwards to Win2)
;  ALT+W         = Regenerate latest PM answer shorter/clearer
;  ALT+Q         = Rare TPM/code context fallback only
;  ALT+A         = Rare TPM/code explanation fallback only
;  ALT+S         = Screenshot + PM context prompt to Win2
;  ALT+E         = Export PM session from Win2
;  ALT+Z         = Mute/unmute Win1 mic (moves Win1 to known pos, clicks, restores)
;  ALT+1         = Disabled in PM mode (code focus overlay not used)
; ============================================================

global BrowserExe := "C:\Program Files (x86)\Microsoft\Edge Beta\Application\msedge.exe"

; ── Mute button client coords inside Win1 ────────────────
; Measured at Win1 size 535x706. These coords are tied to that exact size.
; MUTE_WIN_* deliberately keeps Win1 at the measured dimensions before clicking,
; regardless of which layout is currently active. Do not change these to match
; current layout sizes — the click coords would no longer be valid.
global MUTE_CLIENT_X := 392
global MUTE_CLIENT_Y := 641

; ── Known position for Win1 during mute ──────────────────
; Win1 is moved here before clicking so coords are always valid.
; Size intentionally matches original measurement (535x706), not current layouts.
global MUTE_WIN_X := 425
global MUTE_WIN_Y := 0
global MUTE_WIN_W := 535
global MUTE_WIN_H := 706

SetCapsLockState "AlwaysOff"
SetTitleMatchMode 2
SendMode "Input"
~LAlt::return

; ============================================================
;  PROMPTS  — AHK is the single source of truth for automation prompts.
;             Project/source files define PM answer behavior and truth rules.
; ============================================================

global PM_BOOT_PROMPT_TEXT := ""
    . "You are Sundar’s PM Interview Assistant for this session.`n"
    . "`n"
    . "Primary goal:`n"
    . "Help me answer Product Manager, Technical Product Manager, Product Owner, and AI/Product-focused interview questions directly, naturally, briefly, truthfully, and in first person.`n"
    . "`n"
    . "Default live-answer behavior:`n"
    . "- Give only the answer I can say out loud immediately.`n"
    . "- Use first person.`n"
    . "- Use natural spoken language.`n"
    . "- Be PM-focused.`n"
    . "- No preamble.`n"
    . "- No visible route labels.`n"
    . "- No coaching notes unless I ask.`n"
    . "- No “Answer:”, “Say:”, “If pushed:”, or “Likely follow-up:” in live mode.`n"
    . "- Default to 3–5 sentences.`n"
    . "- Use 127 WPM as the conservative reading baseline.`n"
    . "- Do not optimize for 165 or 180 WPM because live interview use requires listening, reading, thinking, and speaking.`n"
    . "- Quick follow-up answer: 35–70 words.`n"
    . "- Standard PM answer: 70–110 words.`n"
    . "- Case-style answer: 110–160 words only when the question clearly requires it.`n"
    . "- Use 2–3 minute answers only when I explicitly ask for depth.`n"
    . "- Do not dump frameworks.`n"
    . "- Do not mention frameworks by name unless asked.`n"
    . "- Use frameworks internally only.`n"
    . "`n"
    . "Strict scope:`n"
    . "This session is for PM, TPM, Product Owner, and AI/Product-focused PM interviews.`n"
    . "Do not answer as a frontend, React, JavaScript, coding, Codex, or software-engineering interview assistant unless I explicitly ask.`n"
    . "Do not frame me as a frontend engineer or software engineer.`n"
    . "Do not claim frontend/SWE experience unless I explicitly ask.`n"
    . "If technology appears in the question, translate it into PM language: user impact, business impact, feasibility, tradeoffs, engineering collaboration, sequencing, risk, launch quality, and stakeholder alignment.`n"
    . "`n"
    . "Career positioning:`n"
    . "Treat my background as PM/product/product-operations/product-analytics experience, not software engineering experience.`n"
    . "Current company: DataCaliper.`n"
    . "Prior company: TPI Composites, only if this is accurate in the session context or resume.`n"
    . "Do not invent another employer or a fake second company.`n"
    . "If a second company, target company, or target domain is discussed, treat it as target-company/domain strategy, not claimed work history.`n"
    . "Best-fit positioning domains are industrial AI, climate-tech, renewable energy operations SaaS, industrial analytics, and manufacturing/energy product platforms.`n"
    . "TPI Composites can support renewable/manufacturing/industrial context only if it is present in the provided resume/session context.`n"
    . "DataCaliper can support data/product analytics/platform context.`n"
    . "`n"
    . "Internal classification:`n"
    . "Before answering, silently classify the latest interviewer question into the best route:`n"
    . "WHY-PM, BEHAVIORAL, PRODUCT-SENSE, EXECUTION, METRICS, STRATEGY, ESTIMATION, TECH-TO-PM, PO-AGILE, AI-PM, or CODE-PM.`n"
    . "Use the route only to shape the answer. Do not show the route label unless I ask.`n"
    . "Use CODE-PM only as a rare TPM fallback for explicit technical/product questions.`n"
    . "`n"
    . "Truth constraints:`n"
    . "Never fabricate a second employer, employment dates, PM ownership, metrics, user research, business impact, A/B tests, roadmap authority, company facts, or product outcomes.`n"
    . "If exact career details are missing, use conservative phrasing.`n"
    . "Safe phrases include “I worked on,” “I contributed to,” “I helped clarify,” “I approached it with a product mindset,” and “My experience has been around product, data, and operational decision-making.”`n"
    . "If ownership or impact is unclear, phrase conservatively.`n"
    . "Do not convert target-company strategy into claimed work history.`n"
    . "`n"
    . "Resume/JD context:`n"
    . "Use any resume, job description, and session context provided below as background only.`n"
    . "Do not summarize it unless asked.`n"
    . "Do not force it into every answer.`n"
    . "Use it only when it improves the answer.`n"
    . "Do not invent details from it.`n"
    . "If the resume or JD conflicts with assumptions in this prompt, use the provided resume/session facts as the source of truth and stay conservative.`n"
    . "`n"
    . "Follow-up behavior:`n"
    . "If the interviewer asks a follow-up, continue from the current context and answer only the follow-up.`n"
    . "Do not restart the full framework.`n"
    . "If there is no actionable interviewer question, respond only:`n"
    . "No action needed.`n"
    . "`n"
    . "When I ask for review, coaching, rating, or post-interview analysis, you may switch out of live-answer mode and provide structured feedback.`n"
    . "`n"
    . "Session context follows, if provided.`n"
    . "`n"
    . "Do not respond to this setup prompt itself.`n"

global promptWin2Reset := ""
    . "Regenerate the latest answer for a PM interview.`n"
    . "`n"
    . "Make it:`n"
    . "- direct,`n"
    . "- first person,`n"
    . "- natural,`n"
    . "- 3–5 sentences,`n"
    . "- 70–110 words if possible,`n"
    . "- PM/TPM/PO framed depending on the question,`n"
    . "- no route label,`n"
    . "- no framework explanation,`n"
    . "- no fake metrics or ownership,`n"
    . "- no frontend/SWE framing.`n"
    . "`n"
    . "Use the current session context, resume, and JD only if relevant.`n"
    . "Return only the improved answer.`n"

global promptExplain := ""
    . "Optional TPM/code fallback only.`n"
    . "`n"
    . "Explain this technical snippet as PM/TPM interview context, not as a coding interview answer.`n"
    . "Focus on product risk, feasibility, engineering collaboration, tradeoffs, launch quality, and user/business impact.`n"
    . "Use implementation details only when they matter to the PM decision.`n"
    . "Return a concise first-person spoken answer.`n"
    . "`n"
    . "CODE OR TECHNICAL CONTEXT:`n"
    . "`n"

global promptCodeSync := ""
    . "Optional TPM/code fallback only.`n"
    . "`n"
    . "Use this as technical context for future TPM/AI-PM/Product questions.`n"
    . "Do not switch into frontend/SWE interview mode.`n"
    . "Do not respond to this context sync prompt.`n"
    . "For future questions, translate technical details into PM language: user impact, business impact, feasibility, risk, sequencing, stakeholder alignment, and launch quality.`n"
    . "`n"
    . "TECHNICAL CONTEXT:`n"
    . "`n"

global promptScreenshot := "[CONTEXT SYNC] For PM interview context, briefly identify what is visible and how it affects the latest product, TPM, execution, metrics, or strategy answer. Do not switch into coding interview mode."

BuildBootPrompt() {
    global PM_BOOT_PROMPT_TEXT
    prompt := PM_BOOT_PROMPT_TEXT
    ctxPath := A_ScriptDir "\session_context.md"

    if FileExist(ctxPath) {
        try {
            ctx := FileRead(ctxPath, "UTF-8")
            if (Trim(ctx) != "") {
                prompt .= "`n`n---`n`nSESSION CONTEXT`n`n" . ctx
            }
        } catch Error as err {
            prompt .= "`n`n---`n`nSESSION CONTEXT LOAD ERROR`n" . err.Message
        }
    }

    return prompt
}

; ============================================================
;  LAYOUTS & STATE
;
;  g_mode:  1 = 2-window  (both windows visible on screen)
;           2 = 1-window  (Win2 on screen, Win1 ghosted at OFF_X)
;           hidden state is tracked separately by g_hidden
;
;  In 1-win mode: Win2 is at a layoutSolo position ON your 1920px screen.
;                 Win1 is at x=3840 (off-screen), ghosted, still running.
; ============================================================

; 2-win layouts: [Win1_x, Win1_y, Win1_w, Win1_h, Win2_x, Win2_y, Win2_w, Win2_h]
; 16px overlap on all layouts to eliminate browser chrome gap.
; All layouts are Win1-left Win2-right.
global layout2Win := [
    [0,    0, 420, 740,  404,  0, 420, 740],   ; 1. Left  Short  (Win1@0→420, Win2@404→824)
    [380,  0, 580, 740,  944,  0, 580, 740],   ; 2. Mid   Short  (Win1@380→960, Win2@944→1524)
    [1080, 0, 420, 740,  1484, 0, 420, 740],   ; 3. Right Short  (Win1@1080→1500, Win2@1484→1904)
    [0,    0, 440, 1032, 424,  0, 440, 1032],  ; 4. Left  Tall   (Win1@0→440, Win2@424→864)
    [360,  0, 600, 1032, 944,  0, 600, 1032],  ; 5. Mid   Tall   (Win1@360→960, Win2@944→1544)
    [1080, 0, 428, 1032, 1492, 0, 428, 1032],  ; 6. Right Tall   (Win1@1080→1508, Win2@1492→1920, 16px overlap)
]

; 1-win solo layouts for Win2 only: [Win2_x, Win2_y, Win2_w, Win2_h]
global layoutSolo := [
    [0,    0, 535, 1032],  ; 1. Left
    [692,  0, 535, 1032],  ; 2. Center
    [1385, 0, 535, 1032],  ; 3. Right
]

global OFF_X := 3840
global OFF_Y := 0

global g_hWin1               := 0
global g_hWin2               := 0
global g_mode                := 1
global g_pos2Win             := 1
global g_posWin2             := 1
global g_muted               := false
global g_suppressClipMonitor := false
global g_layoutEnteredAt     := A_TickCount
global g_currentLayout       := {mode: 1, pos2Win: 1, posWin2: 1}
global g_lastStableLayout    := 0
global g_hidden              := false
global g_hiddenLayout        := 0

; ============================================================
;  ALT+R — LAUNCH
;  Launches in --app mode with aggressive performance flags 
;  to prevent the background/ghost window from sleeping.
; ============================================================

!r:: {
    AutoStartup()
}

AutoStartup() {
    global g_hWin1, g_hWin2, BrowserExe
    global g_mode, g_pos2Win, g_posWin2
    global g_layoutEnteredAt, g_currentLayout, g_lastStableLayout

    if IsAlive(g_hWin1)
        WinClose "ahk_id " g_hWin1
    if IsAlive(g_hWin2)
        WinClose "ahk_id " g_hWin2
    g_hWin1 := 0
    g_hWin2 := 0

    ; Performance flags to keep ghosted window fully active
    flags := " --disable-background-timer-throttling"
        . " --disable-backgrounding-occluded-windows"
        . " --disable-renderer-backgrounding"
        . " --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling"

    Run BrowserExe ' --app="https://chatgpt.com/?vb_role=sender"' . flags
    Run BrowserExe ' --app="https://chatgpt.com/?vb_role=receiver"' . flags

    if !WinWait("VB_SENDER", , 15) {
        ToolTip "❌ Win1 not detected. Is Tampermonkey active?",,,1
        SetTimer () => ToolTip(,,,1), -4000
        return
    }
    g_hWin1 := WinGetID("VB_SENDER")

    if !WinWait("VB_RECEIVER", , 10) {
        ToolTip "❌ Win2 not detected.",,,1
        SetTimer () => ToolTip(,,,1), -4000
        return
    }
    g_hWin2 := WinGetID("VB_RECEIVER")

    EnsureAlwaysOnTop(g_hWin1)
    EnsureAlwaysOnTop(g_hWin2)

    g_mode    := 1
    g_pos2Win := 1
    g_posWin2 := 1
    g_lastStableLayout := 0

    Apply2WinLayout(1)
    RecordLayoutChange(1, 1, 1)

    ; Boot prompt → Win1 only.
    ; Win1 sender script forwards it to Win2 via localStorage automatically.
    Sleep 1000
    SendToWindow(BuildBootPrompt(), "^+{F5}", g_hWin1)

    WinActivate "ahk_id " g_hWin2
}

EnsureAlwaysOnTop(hwnd) {
    if !IsAlive(hwnd)
        return
    exStyle := WinGetExStyle("ahk_id " hwnd)
    if !(exStyle & 0x8) {
        WinActivate "ahk_id " hwnd
        Sleep 200
        if WinWaitActive("ahk_id " hwnd, , 2) {
            Sleep 100
            Send "^#t"
            Sleep 300
        }
    }
}

; ============================================================
;  ALT+CAPSLOCK — CYCLE MODES: 2-win → 1-win → hidden → 2-win
; ============================================================

!CapsLock:: {
    global g_mode, g_pos2Win, g_posWin2, g_hWin1, g_hWin2, g_hidden, g_hiddenLayout, g_currentLayout

    SetCapsLockState "AlwaysOff"

    if (!IsAlive(g_hWin1) || !IsAlive(g_hWin2))
        return

    if (g_hidden) {
        g_hidden := false
        g_mode := 1
        RestoreWin1Visibility()
        Apply2WinLayout(g_pos2Win)
        RecordLayoutChange(1, g_pos2Win, g_posWin2)
        WinActivate "ahk_id " g_hWin2
        return
    }

    if (g_mode = 1) {
        ; 2-window → 1-window
        g_mode := 2
        ApplySoloLayout(g_posWin2)
        GhostWin1()
        RecordLayoutChange(2, g_pos2Win, g_posWin2)
        WinActivate "ahk_id " g_hWin2
        return
    }

    if (g_mode = 2) {
        ; 1-window → hidden
        g_hiddenLayout := {
            mode:    g_currentLayout.mode,
            pos2Win: g_currentLayout.pos2Win,
            posWin2: g_currentLayout.posWin2
        }
        RestoreWin1Visibility()
        HideAllManaged()
        g_hidden := true
        return
    }
}

; ============================================================
;  CAPSLOCK — CYCLE LAYOUT PRESETS WITHIN CURRENT MODE
; ============================================================

CapsLock:: {
    global g_mode, g_pos2Win, g_posWin2, layout2Win, layoutSolo
    SetCapsLockState "AlwaysOff"

    if (g_mode = 1) {
        next := Mod(g_pos2Win, layout2Win.Length) + 1
        Apply2WinLayout(next)
        RecordLayoutChange(1, next, g_posWin2)

    } else if (g_mode = 2) {
        next := Mod(g_posWin2, layoutSolo.Length) + 1
        ApplySoloLayout(next)
        RecordLayoutChange(2, g_pos2Win, next)
    }
}

; ============================================================
;  ALT+TAB — SWITCH FOCUS BETWEEN MANAGED WINDOWS
; ============================================================

!Tab:: {
    SwitchManagedFocus()
}

SwitchManagedFocus() {
    global g_hWin1, g_hWin2, g_mode, g_hidden

    if (!IsAlive(g_hWin1) || !IsAlive(g_hWin2) || g_hidden)
        return

    active := WinGetID("A")

    if (active = g_hWin2 && g_mode = 1) {
        WinActivate "ahk_id " g_hWin1
    } else {
        WinActivate "ahk_id " g_hWin2
    }
}

; ============================================================
;  GHOST / VISIBILITY HELPERS
; ============================================================

GhostWin1() {
    global g_hWin1, OFF_X
    ; Set WS_EX_LAYERED first, then transparency, then move off-screen.
    WinSetExStyle "+0x80000", "ahk_id " g_hWin1   ; WS_EX_LAYERED
    WinSetTransparent 13, "ahk_id " g_hWin1        ; ~5% opacity
    WinSetExStyle "+0x20", "ahk_id " g_hWin1       ; WS_EX_TRANSPARENT (click-through)
    WinMove OFF_X, 0, 960, 1032, "ahk_id " g_hWin1
}

RestoreWin1Visibility() {
    global g_hWin1
    WinSetExStyle "-0x20", "ahk_id " g_hWin1       ; remove click-through
    WinSetTransparent "Off", "ahk_id " g_hWin1      ; remove transparency
    WinSetExStyle "-0x80000", "ahk_id " g_hWin1     ; remove WS_EX_LAYERED
}

; ============================================================
;  LAYOUT APPLIERS
; ============================================================

HideAllManaged() {
    global g_hWin1, g_hWin2, OFF_X, OFF_Y
    if IsAlive(g_hWin1)
        WinMove OFF_X, OFF_Y, 960, 1032, "ahk_id " g_hWin1
    if IsAlive(g_hWin2)
        WinMove OFF_X, OFF_Y, 960, 1032, "ahk_id " g_hWin2
}

Apply2WinLayout(idx) {
    global layout2Win, g_pos2Win, g_hWin1, g_hWin2
    g_pos2Win := idx
    p := layout2Win[idx]
    ; Always ensure Win1 is fully visible when applying 2-win layout
    RestoreWin1Visibility()
    if IsAlive(g_hWin1)
        WinMove p[1], p[2], p[3], p[4], "ahk_id " g_hWin1
    if IsAlive(g_hWin2)
        WinMove p[5], p[6], p[7], p[8], "ahk_id " g_hWin2
}

ApplySoloLayout(idx) {
    global layoutSolo, g_posWin2, g_hWin2
    g_posWin2 := idx
    p := layoutSolo[idx]
    if IsAlive(g_hWin2)
        WinMove p[1], p[2], p[3], p[4], "ahk_id " g_hWin2
}

; ============================================================
;  LAYOUT STATE
; ============================================================

RecordLayoutChange(newMode, newPos2Win, newPosWin2) {
    global g_layoutEnteredAt, g_currentLayout, g_lastStableLayout
    now := A_TickCount
    if (now - g_layoutEnteredAt >= 5000) {
        g_lastStableLayout := {
            mode:    g_currentLayout.mode,
            pos2Win: g_currentLayout.pos2Win,
            posWin2: g_currentLayout.posWin2
        }
    }
    g_currentLayout := {mode: newMode, pos2Win: newPos2Win, posWin2: newPosWin2}
    g_layoutEnteredAt := now
}

RestoreLayout(layout) {
    global g_mode, g_pos2Win, g_posWin2

    g_mode    := layout.mode
    g_pos2Win := layout.pos2Win
    g_posWin2 := layout.posWin2

    if (layout.mode = 1) {
        RestoreWin1Visibility()
        Apply2WinLayout(layout.pos2Win)
    } else if (layout.mode = 2) {
        ApplySoloLayout(layout.posWin2)
        GhostWin1()
    }
    RecordLayoutChange(layout.mode, layout.pos2Win, layout.posWin2)
}

; ============================================================
;  TOOL SHORTCUTS
; ============================================================

; Alt+Esc — Resend PM boot prompt + session_context.md to Win1.
; Win1 sender script forwards it to Win2 via localStorage.
!Esc:: {
    global g_hWin1
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if IsAlive(g_hWin1)
        SendToWindow(BuildBootPrompt(), "^+{F5}", g_hWin1)
}

; Alt+W — Regenerate latest PM answer shorter/clearer in Win2
!w:: {
    global promptWin2Reset, g_hWin2
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if IsAlive(g_hWin2)
        SendToWindow(promptWin2Reset, "^+{F2}", g_hWin2)
}

; Alt+E — Export PM session from Win2
!e:: {
    global g_hWin2
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if IsAlive(g_hWin2)
        SendToWindow("", "^+{F8}", g_hWin2)
}

; Alt+Q — Rare TPM/code fallback: grab active editor text as technical context
!q:: {
    global g_hWin2, promptCodeSync
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if !IsAlive(g_hWin2)
        return
    hSource := WinGetID("A")
    editorText := GrabEditorText(hSource)
    if (editorText != "")
        SendToWindow(promptCodeSync . "`n" . editorText, "^+{F1}", g_hWin2)
}

; Alt+A — Rare TPM/code fallback: explain clipboard technical context
!a:: {
    global promptExplain, g_hWin2
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if !IsAlive(g_hWin2)
        return
    textToExplain := A_Clipboard
    if (textToExplain != "")
        SendToWindow(promptExplain . textToExplain, "^+{F4}", g_hWin2)
}

; Alt+S — Screenshot + context prompt to Win2
!s:: {
    global g_hWin2, g_suppressClipMonitor, promptScreenshot
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if !IsAlive(g_hWin2)
        return
    g_suppressClipMonitor := true
    A_Clipboard := ""
    DllCall("keybd_event", "int", 0x2C, "int", 0, "int", 0, "int", 0)
    DllCall("keybd_event", "int", 0x2C, "int", 0, "int", 2, "int", 0)
    if !ClipWait(2, 1) {
        g_suppressClipMonitor := false
        return
    }
    WinActivate "ahk_id " g_hWin2
    WinWaitActive "ahk_id " g_hWin2, , 2
    Sleep 100
    Send "^+{F9}"
    Sleep 200
    Send "^v"
    Sleep 1000
    Send "{Text}" promptScreenshot
    Sleep 200
    Send "{Enter}"
    g_suppressClipMonitor := false
}

; Alt+Shift — Toggle scroll lock on Win2
!Shift:: {
    global g_hWin2
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    if IsAlive(g_hWin2)
        SendToWindow("", "^+{F10}", g_hWin2)
}

; Alt+X — Disabled for PM-only simplicity.
;  Use Alt+Shift as the only scroll-lock shortcut.
!x:: {
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    ToolTip "Unused in PM mode. Use Alt+Shift for scroll lock."
    SetTimer () => ToolTip(), -1200
}

; Alt+1 — Disabled for PM-only simplicity.
;  Code focus overlay is not part of the default PM interview workflow.
!1:: {
    if GetKeyState("Alt", "P")
        KeyWait "Alt"
    ToolTip "Code focus disabled in PM mode."
    SetTimer () => ToolTip(), -1200
}

; Alt+Z — Mute/unmute Win1 mic
;  Pattern (ported from original):
;  1. Save current layout
;  2. Move Win1 to known fixed position (matches coords when mic was measured)
;  3. ControlClick mic button at measured client coords
;  4. Restore previous layout
;  5. Re-activate whichever window was active before
;
;  This works regardless of current mode (2-win, 1-win ghost, hidden).
;  Win1 is briefly visible during the click, then immediately restored.
!z:: {
    global g_hWin1, g_muted, g_currentLayout
    global MUTE_CLIENT_X, MUTE_CLIENT_Y
    global MUTE_WIN_X, MUTE_WIN_Y, MUTE_WIN_W, MUTE_WIN_H

    if !IsAlive(g_hWin1)
        return
    if GetKeyState("Alt", "P")
        KeyWait "Alt"

    ; Step 1: Save current layout and active window
    savedLayout := {
        mode:    g_currentLayout.mode,
        pos2Win: g_currentLayout.pos2Win,
        posWin2: g_currentLayout.posWin2
    }
    savedActive := WinGetID("A")

    ; Step 2: Make Win1 fully visible and move to known measured position
    RestoreWin1Visibility()
    WinMove MUTE_WIN_X, MUTE_WIN_Y, MUTE_WIN_W, MUTE_WIN_H, "ahk_id " g_hWin1
    Sleep 80

    ; Step 3: Click mic button using client-relative coords (no activation needed)
    ControlClick "x" MUTE_CLIENT_X " y" MUTE_CLIENT_Y, "ahk_id " g_hWin1, , "Left", 1, "NA"
    Sleep 100

    g_muted := !g_muted

    ; Step 4: Restore previous layout (moves Win1 back, re-ghosts if needed)
    RestoreLayout(savedLayout)

    ; Step 5: Return focus to original window
    if (savedActive != 0 && WinExist("ahk_id " savedActive))
        WinActivate "ahk_id " savedActive
}

; ============================================================
;  HELPERS
; ============================================================

IsAlive(hWnd) {
    return (hWnd != 0 && WinExist("ahk_id " hWnd))
}

GrabEditorText(hSource) {
    global g_suppressClipMonitor, g_hWin1, g_hWin2
    if (hSource = g_hWin1 || hSource = g_hWin2)
        return ""
    g_suppressClipMonitor := true
    savedClip := ClipboardAll()
    A_Clipboard := ""
    WinActivate "ahk_id " hSource
    WinWaitActive "ahk_id " hSource, , 1
    Send "^a"
    Sleep 50
    Send "^c"
    if !ClipWait(2) {
        A_Clipboard := savedClip
        g_suppressClipMonitor := false
        return ""
    }
    result := A_Clipboard
    Send "{Right}"
    A_Clipboard := savedClip
    g_suppressClipMonitor := false
    return result
}

SendToWindow(msg, shortcut, hTarget) {
    global g_suppressClipMonitor
    if !IsAlive(hTarget)
        return
    g_suppressClipMonitor := true
    savedClip := ""
    try {
        if (msg != "") {
            savedClip := ClipboardAll()
            A_Clipboard := msg
            Sleep 100
        }
        WinActivate "ahk_id " hTarget
        if GetKeyState("Alt", "P")
            KeyWait "Alt"
        WinWaitActive "ahk_id " hTarget, , 1
        Sleep 100
        Send shortcut
        Sleep 200
        if (msg != "") {
            Sleep 400
            A_Clipboard := savedClip
        }
    }
    g_suppressClipMonitor := false
}
