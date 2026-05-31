#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================
;  PM Interview Session Tracker — End-Session Companion
;  Runs ALONGSIDE Final_2_Window_Fixed.ahk. Does NOT modify or
;  replace the launcher. Safe to close independently.
;
;  ALT+SHIFT+E = end session: export both windows -> collect
;                metadata -> run push-session-to-tracker.ps1.
;
;  This script holds NO GitHub token. Git auth is the local
;  machine's credentials, used only by the PowerShell script
;  against the SEPARATE private tracker repo.
; ============================================================

; ---- Configure these once for your machine ----
global TRACKER_REPO_PATH := "C:\Users\Sundar\Documents\pm-interview-session-tracker"
global PUSH_SCRIPT       := A_ScriptDir "\scripts\push-session-to-tracker.ps1"
global REVIEW_PROMPT      := A_ScriptDir "\..\templates\session-tracker\review_lab_prompt.md"
global DOWNLOADS_DIR      := A_MyDocuments "\..\Downloads"   ; default Windows Downloads

!+e::EndSessionFlow()

EndSessionFlow() {
    global TRACKER_REPO_PATH, PUSH_SCRIPT, REVIEW_PROMPT, DOWNLOADS_DIR

    ; 1. Trigger export in BOTH windows via the exporter's Ctrl+Shift+F9 hotkey.
    ;    (AHK cannot write localStorage directly; sending the exporter hotkey to
    ;     each window is the reliable trigger. The localStorage broadcast key
    ;     'pm_session_tracker_export_request' remains a manual/console alternative.)
    if !TriggerExport("VB_SENDER") {
        MsgBox "Win1 (VB_SENDER) not found. Is the interview running?", "Session Tracker", "Icon!"
        return
    }
    Sleep 600
    if !TriggerExport("VB_RECEIVER") {
        MsgBox "Win2 (VB_RECEIVER) not found.", "Session Tracker", "Icon!"
        return
    }
    Sleep 1500  ; let both downloads land

    ; 2. Try to auto-find the newest exported files in Downloads.
    win1 := NewestFile(DOWNLOADS_DIR, "*_win1_sender.md")
    win2 := NewestFile(DOWNLOADS_DIR, "*_win2_receiver.md")

    win1 := InputPath("Win1 sender file", win1)
    if (win1 = "")
        return
    win2 := InputPath("Win2 receiver file", win2)
    if (win2 = "")
        return

    ; 3. Collect session metadata.
    sType := AskChoice("Session type (practice / real)", "practice")
    if (sType = "")
        return
    company := AskField("Company", "")
    role    := AskField("Target role", "PM")
    round   := AskField("Interview round (recruiter/hm/product-sense/metrics/behavioral/technical-pm/po)", "behavioral")
    mode    := AskField("Mode (mock / practice / live)", "mock")
    repo    := InputPath("Tracker repo path", TRACKER_REPO_PATH)
    if (repo = "")
        return

    ; 4. Run the push script.
    cmd := 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' PUSH_SCRIPT '"'
        . ' -SessionType "' sType '" -Company "' company '" -Role "' role '"'
        . ' -Round "' round '" -Mode "' mode '"'
        . ' -Win1File "' win1 '" -Win2File "' win2 '"'
        . ' -TrackerRepoPath "' repo '"'

    exit := RunWait(A_ComSpec ' /k ' cmd,, "")  ; /k keeps the window open so output is visible
    ; (Use /k during testing; switch to /c once trusted.)

    ; 5. Offer the Review Lab prompt.
    if FileExist(REVIEW_PROMPT) {
        try {
            A_Clipboard := FileRead(REVIEW_PROMPT)
            MsgBox "Session pushed. Review Lab prompt copied to clipboard.`nPaste it into the Review Lab with the two session files.", "Session Tracker", "Iconi"
        } catch {
            MsgBox "Session pushed. Review Lab prompt at:`n" REVIEW_PROMPT, "Session Tracker", "Iconi"
        }
    } else {
        MsgBox "Session pushed. (Review Lab prompt file not found.)", "Session Tracker", "Iconi"
    }
}

TriggerExport(winTitle) {
    hwnd := WinExist(winTitle)
    if !hwnd
        return false
    WinActivate hwnd
    if !WinWaitActive(hwnd, , 3)
        return false
    Sleep 150
    Send "^+{F9}"
    return true
}

NewestFile(dir, pattern) {
    newest := "", newestTime := 0
    try {
        Loop Files, dir "\" pattern {
            t := FileGetTime(A_LoopFilePath, "M")
            if (t > newestTime) {
                newestTime := t
                newest := A_LoopFilePath
            }
        }
    }
    return newest
}

InputPath(label, default) {
    ib := InputBox("Confirm or paste path:`n" label, "Session Tracker", "w560 h140", default)
    if (ib.Result != "OK")
        return ""
    return Trim(ib.Value)
}

AskField(label, default) {
    ib := InputBox(label, "Session Tracker", "w420 h130", default)
    if (ib.Result != "OK")
        return ""
    return Trim(ib.Value)
}

AskChoice(label, default) {
    ib := InputBox(label, "Session Tracker", "w420 h130", default)
    if (ib.Result != "OK")
        return ""
    v := Trim(StrLower(ib.Value))
    if (v != "practice" && v != "real") {
        MsgBox "Session type must be 'practice' or 'real'.", "Session Tracker", "Icon!"
        return ""
    }
    return v
}
