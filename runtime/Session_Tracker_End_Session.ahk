#Requires AutoHotkey v2.0
#SingleInstance Force

; Companion for the active Manifest V3 PMIA runtime.
; Alt+Shift+E opens the end-session panel.
; It discovers one exact PMIA sender/receiver pair, exports both role logs,
; locates the generated Markdown files, and can push them to the tracker.

if (A_Args.Length >= 1 && A_Args[1] = "--validate") {
    FileAppend "TRACKER_AHK_VALID`n", "*"
    ExitApp 0
}

SetTitleMatchMode 3
SendMode "Input"
SendLevel 1

global RepoRoot := A_ScriptDir "\.."
global PushScript := RepoRoot "\runtime\scripts\push-session-to-tracker.ps1"

!+e::ShowEndSessionGui()
ShowEndSessionGui()

ShowEndSessionGui() {
    global PushScript
    g := Gui("+AlwaysOnTop", "PM Session Tracker — End Session")
    g.SetFont("s9", "Segoe UI")

    g.AddText("x16 y16 w120", "Session type")
    sessionType := g.AddDropDownList("x150 y12 w180", ["practice", "real"])
    sessionType.Value := 1

    g.AddText("x16 y50 w120", "Company")
    company := g.AddEdit("x150 y46 w300", "unknown")
    g.AddText("x16 y84 w120", "Role")
    role := g.AddEdit("x150 y80 w300", "pm")
    g.AddText("x16 y118 w120", "Round")
    round := g.AddEdit("x150 y114 w300", "unknown")
    g.AddText("x16 y152 w120", "Mode")
    mode := g.AddEdit("x150 y148 w300", "mock")

    g.AddText("x16 y190 w120", "Tracker repo")
    tracker := g.AddEdit("x150 y186 w420", "C:\Users\Sundar\Documents\pm-interview-session-tracker")
    g.AddButton("x580 y184 w80", "Browse").OnEvent("Click", (*) => BrowseFolder(tracker))

    g.AddText("x16 y228 w120", "Sender export")
    win1 := g.AddEdit("x150 y224 w420")
    g.AddButton("x580 y222 w80", "Browse").OnEvent("Click", (*) => BrowseFile(win1))
    g.AddText("x16 y266 w120", "Receiver export")
    win2 := g.AddEdit("x150 y262 w420")
    g.AddButton("x580 y260 w80", "Browse").OnEvent("Click", (*) => BrowseFile(win2))

    closeMain := g.AddCheckBox("x16 y304 w640 Checked", "After successful push, end the active PMIA session")
    status := g.AddText("x16 y332 w650 h36", "Ready. Export discovery requires exactly one complete PMIA session.")
    status.SetFont("s9 c475569", "Segoe UI")

    g.AddButton("x16 y378 w150", "Export Both Windows").OnEvent("Click", (*) => ExportBothWindows(win1, win2, status))
    g.AddButton("x180 y378 w150", "Push Session").OnEvent("Click", (*) => PushSession(sessionType, company, role, round, mode, win1, win2, tracker, closeMain, status))
    g.AddButton("x344 y378 w170", "Copy Review Prompt").OnEvent("Click", (*) => CopyReviewPrompt(sessionType, company, role, round, mode))
    g.AddButton("x528 y378 w90", "Close").OnEvent("Click", (*) => g.Destroy())

    g.AddText("x16 y418 w650", "Export discovery uses current PMIA lifecycle titles and Ctrl+Shift+F8. Browse remains available as recovery.")
    g.Show("w690 h462")
}

BrowseFolder(ctrl) {
    selected := DirSelect(, 3, "Select tracker repo folder")
    if selected
        ctrl.Value := selected
}

BrowseFile(ctrl) {
    selected := FileSelect(1, A_Desktop, "Select exported Markdown file", "Markdown (*.md)")
    if selected
        ctrl.Value := selected
}

ParsePmiaWindowTitle(title) {
    pattern := "^PMIA_(?:BOOT_|REGISTERED_)?(SENDER|RECEIVER)_(CHATGPT|CLAUDE)_(.+)$"
    if !RegExMatch(title, pattern, &match)
        return 0

    phase := "READY"
    if (InStr(title, "PMIA_BOOT_") = 1)
        phase := "BOOT"
    else if (InStr(title, "PMIA_REGISTERED_") = 1)
        phase := "REGISTERED"
    return Map(
        "role", StrLower(match[1]),
        "provider", StrLower(match[2]),
        "sessionId", match[3],
        "phase", phase,
        "score", phase = "READY" ? 3 : phase = "REGISTERED" ? 2 : 1
    )
}

FindActivePmiaSession() {
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    sessions := Map()
    try {
        for hwnd in WinGetList("ahk_exe msedge.exe") {
            info := ParsePmiaWindowTitle(WinGetTitle("ahk_id " hwnd))
            if !IsObject(info)
                continue
            id := info["sessionId"]
            if !sessions.Has(id) {
                sessions[id] := Map(
                    "sessionId", id,
                    "senderHwnd", 0, "senderScore", 0,
                    "receiverHwnd", 0, "receiverScore", 0
                )
            }
            record := sessions[id]
            role := info["role"]
            if (info["score"] > record[role "Score"]) {
                record[role "Hwnd"] := hwnd
                record[role "Score"] := info["score"]
            }
        }
    } finally {
        DetectHiddenWindows previousDetectHidden
    }

    completeSessions := []
    for _, record in sessions {
        if record["senderHwnd"] && record["receiverHwnd"]
            completeSessions.Push(record)
    }
    if (completeSessions.Length = 0)
        return Map("ok", false, "code", "NO_ACTIVE_PMIA_SESSION", "message", "No complete PMIA sender/receiver session is open.")
    if (completeSessions.Length > 1)
        return Map("ok", false, "code", "AMBIGUOUS_PMIA_SESSIONS", "message", "More than one complete PMIA session is open. End stale sessions first.")
    result := completeSessions[1]
    result["ok"] := true
    return result
}

SendToWindow(shortcut, hwnd) {
    if !hwnd || !WinExist("ahk_id " hwnd)
        return false
    WinActivate "ahk_id " hwnd
    if !WinWaitActive("ahk_id " hwnd, , 2)
        return false
    Send shortcut
    return true
}

GetDownloadsDirectory() {
    key := "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
    valueName := "{374DE290-123F-4565-9164-39C4925E467B}"
    try {
        configured := RegRead(key, valueName)
        expanded := ComObject("WScript.Shell").ExpandEnvironmentStrings(configured)
        if DirExist(expanded)
            return expanded
    } catch {
        ; Fall through to the profile Downloads directory.
    }
    fallback := EnvGet("USERPROFILE") "\Downloads"
    return DirExist(fallback) ? fallback : A_Desktop
}

FindNewestRoleExport(downloadDir, sessionId, role, startedAt) {
    newestPath := ""
    newestTime := ""
    needle := "pmia-session-" StrLower(sessionId) "-" StrLower(role) "-"
    Loop Files downloadDir "\pmia-session-*.md", "F" {
        if (A_LoopFileTimeModified < startedAt)
            continue
        if !InStr(StrLower(A_LoopFileName), needle)
            continue
        if (newestTime = "" || A_LoopFileTimeModified > newestTime) {
            newestTime := A_LoopFileTimeModified
            newestPath := A_LoopFileFullPath
        }
    }
    return newestPath
}

WaitForRoleExports(downloadDir, sessionId, startedAt, timeoutMs := 15000) {
    deadline := A_TickCount + timeoutMs
    while (A_TickCount < deadline) {
        sender := FindNewestRoleExport(downloadDir, sessionId, "sender", startedAt)
        receiver := FindNewestRoleExport(downloadDir, sessionId, "receiver", startedAt)
        if (sender != "" && receiver != "")
            return Map("ok", true, "sender", sender, "receiver", receiver)
        Sleep 250
    }
    return Map("ok", false, "code", "EXPORT_TIMEOUT", "message", "PMIA exports were not found in Downloads before the timeout.")
}

ExportBothWindows(win1, win2, status) {
    session := FindActivePmiaSession()
    if !session["ok"] {
        status.Value := session["code"] ": " session["message"]
        MsgBox status.Value
        return false
    }

    downloadDir := GetDownloadsDirectory()
    startedAt := A_Now
    status.Value := "Exporting session " session["sessionId"] "..."
    if !SendToWindow("^+{F8}", session["senderHwnd"]) {
        status.Value := "SENDER_EXPORT_FAILED: sender window did not accept the export shortcut."
        MsgBox status.Value
        return false
    }
    Sleep 200
    if !SendToWindow("^+{F8}", session["receiverHwnd"]) {
        status.Value := "RECEIVER_EXPORT_FAILED: receiver window did not accept the export shortcut."
        MsgBox status.Value
        return false
    }

    exports := WaitForRoleExports(downloadDir, session["sessionId"], startedAt)
    if !exports["ok"] {
        status.Value := exports["code"] ": " exports["message"]
        MsgBox status.Value
        return false
    }
    win1.Value := exports["sender"]
    win2.Value := exports["receiver"]
    status.Value := "Exports ready for session " session["sessionId"] "."
    return true
}

QuoteArg(value) {
    quote := Chr(34)
    escaped := StrReplace(value, quote, "\" quote)
    return quote escaped quote
}

PushSession(sessionType, company, role, round, mode, win1, win2, tracker, closeMain, status) {
    global PushScript
    if !FileExist(PushScript) {
        status.Value := "PUSH_SCRIPT_MISSING: " PushScript
        MsgBox status.Value
        return
    }
    if !FileExist(win1.Value) || !FileExist(win2.Value) {
        status.Value := "EXPORT_FILES_MISSING: export both PMIA roles or browse to both Markdown files."
        MsgBox status.Value
        return
    }

    cmd := "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " QuoteArg(PushScript)
        . " -SessionType " QuoteArg(sessionType.Text)
        . " -Company " QuoteArg(company.Value)
        . " -Role " QuoteArg(role.Value)
        . " -Round " QuoteArg(round.Value)
        . " -Mode " QuoteArg(mode.Value)
        . " -Win1File " QuoteArg(win1.Value)
        . " -Win2File " QuoteArg(win2.Value)
        . " -TrackerRepoPath " QuoteArg(tracker.Value)

    status.Value := "Pushing session to the tracker..."
    exitCode := RunWait(cmd, , "Hide")
    if (exitCode != 0) {
        status.Value := "PUSH_FAILED: script exited with code " exitCode ". The PMIA session remains open."
        MsgBox status.Value
        return
    }

    status.Value := "Session pushed successfully."
    if closeMain.Value
        CloseMainRuntime()
    MsgBox(closeMain.Value
        ? "Session pushed. The active PMIA session close signal was sent."
        : "Session pushed. The active PMIA session remains open.")
}

CloseMainRuntime() {
    session := FindActivePmiaSession()
    if IsObject(session) && session["ok"]
        SendToWindow("!{Delete}", session["senderHwnd"])
}

CopyReviewPrompt(sessionType, company, role, round, mode) {
    prompt := "Review the latest PM interview session from the tracker repo.`n`n"
        . "Session type: " sessionType.Text "`n"
        . "Company: " company.Value "`n"
        . "Role: " role.Value "`n"
        . "Round: " round.Value "`n"
        . "Mode: " mode.Value "`n`n"
        . "Use exactly two files: win1_sender.md and win2_receiver.md.`n"
        . "Give scorecard, what went well, what went badly, weak answers, truth risks, blocked transcript issues, sender/receiver mismatches, recurring-pattern candidates, and top 3 actions before the next session."
    A_Clipboard := prompt
    MsgBox "Review prompt copied to clipboard."
}
