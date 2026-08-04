#Requires AutoHotkey v2.0
#SingleInstance Force
#Warn All, StdOut

global BrowserExe := "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
global PMIA_RUNTIME_CONTROL_MESSAGE := "PMIA_RUNTIME_CONTROL_V1"
global PMIA_RUNTIME_CONTROL_WINDOW := "PMIA_RUNTIME_CONTROL"
global PMIA_RUNTIME_CONTROL_EXPORT := 1
global PMIA_RUNTIME_CONTROL_END := 2
global ReviewLabDefaultUrl := "https://chatgpt.com/"
global SettingsDir := EnvGet("LOCALAPPDATA") "\PMInterviewAssistant"
global ReviewSettingsFile := SettingsDir "\review-settings.ini"
global MainSettingsFile := SettingsDir "\settings.ini"
global ResolverScript := A_ScriptDir "\scripts\resolve-pmia-session-exports.ps1"
global PushScript := A_ScriptDir "\scripts\push-session-to-tracker.ps1"

if (EnvGet("PMIA_VALIDATE") = "1" || (A_Args.Length >= 1 && (A_Args[1] = "--validate" || A_Args[1] = "validate"))) {
    sampleJson := '{"path":"C:\\temp\\pmia"}'
    if JsonString(sampleJson, "path") != "C:\temp\pmia"
        throw Error("Review Studio JSON path decoder validation failed.")
    FileAppend "TRACKER_AHK_VALID`n", "*"
    ExitApp 0
}

SetTitleMatchMode 3
SendMode "Input"

global g_reviewGui := 0
global g_detectedSession := Map()
global g_pairedExport := Map()
global g_statusText := 0
global g_sessionText := 0
global g_routeText := 0
global g_sessionTypeDdl := 0
global g_companyEdit := 0
global g_roleEdit := 0
global g_roundEdit := 0
global g_modeEdit := 0
global g_trackerEdit := 0
global g_downloadEdit := 0
global g_reviewUrlEdit := 0
global g_senderFileEdit := 0
global g_receiverFileEdit := 0
global g_endAfterPush := 0

global g_trackerPath := A_ScriptDir "\..\.local\session-tracker"
global g_downloadDirectory := EnvGet("USERPROFILE") "\Downloads"
global g_reviewLabUrl := ReviewLabDefaultUrl

LoadReviewPreferences()
ShowReviewStudio()

LoadReviewPreferences() {
    global SettingsDir, ReviewSettingsFile
    global g_trackerPath, g_downloadDirectory, g_reviewLabUrl, ReviewLabDefaultUrl
    if !DirExist(SettingsDir)
        DirCreate SettingsDir
    g_trackerPath := IniRead(ReviewSettingsFile, "Review", "TrackerRepoPath", g_trackerPath)
    g_downloadDirectory := IniRead(ReviewSettingsFile, "Review", "DownloadDirectory", g_downloadDirectory)
    g_reviewLabUrl := IniRead(ReviewSettingsFile, "Review", "ReviewLabUrl", ReviewLabDefaultUrl)
}
SaveReviewPreferences() {
    global SettingsDir, ReviewSettingsFile
    global g_trackerEdit, g_downloadEdit, g_reviewUrlEdit
    if !DirExist(SettingsDir)
        DirCreate SettingsDir
    IniWrite g_trackerEdit.Value, ReviewSettingsFile, "Review", "TrackerRepoPath"
    IniWrite g_downloadEdit.Value, ReviewSettingsFile, "Review", "DownloadDirectory"
    IniWrite g_reviewUrlEdit.Value, ReviewSettingsFile, "Review", "ReviewLabUrl"
}

ShowReviewStudio() {
    global g_reviewGui, g_statusText, g_sessionText, g_routeText
    global g_sessionTypeDdl, g_companyEdit, g_roleEdit, g_roundEdit, g_modeEdit
    global g_trackerEdit, g_downloadEdit, g_reviewUrlEdit
    global g_senderFileEdit, g_receiverFileEdit, g_endAfterPush
    global g_trackerPath, g_downloadDirectory, g_reviewLabUrl
    if IsObject(g_reviewGui) {
        try g_reviewGui.Show()
        return
    }

    g_reviewGui := Gui("+AlwaysOnTop", "PM Session Tracker - Review Studio")
    g_reviewGui.Opt("+OwnDialogs")
    g_reviewGui.SetFont("s10", "Segoe UI")
    g_reviewGui.AddText("x20 y16 w700", "PMIA v0.7.0 - Session Review and Learning Loop").SetFont("s15 Bold", "Segoe UI")
    g_reviewGui.AddText("x20 y50 w700", "Export the exact managed session, add it to the private tracker, and open Review Lab without changing live transport.")
    g_sessionText := g_reviewGui.AddText("x20 y84 w700", "Session: not detected")
    g_routeText := g_reviewGui.AddText("x20 y108 w700", "Route: -")
    g_reviewGui.AddButton("x620 y78 w120 h32", "Detect Session").OnEvent("Click", DetectSessionFromGui)
    g_reviewGui.AddText("x20 y150 w110", "Session type")
    g_sessionTypeDdl := g_reviewGui.AddDropDownList("x140 y146 w150 Choose1", ["practice", "real"])
    g_reviewGui.AddText("x320 y150 w70", "Company")
    g_companyEdit := g_reviewGui.AddEdit("x395 y146 w170", "unknown")
    g_reviewGui.AddText("x580 y150 w50", "Role")
    g_roleEdit := g_reviewGui.AddEdit("x635 y146 w105", "pm")

    g_reviewGui.AddText("x20 y190 w110", "Round")
    g_roundEdit := g_reviewGui.AddEdit("x140 y186 w150", "unknown")
    g_reviewGui.AddText("x320 y190 w70", "Mode")
    g_modeEdit := g_reviewGui.AddEdit("x395 y186 w170", "mock")

    g_reviewGui.AddText("x20 y234 w110", "Tracker repo")
    g_trackerEdit := g_reviewGui.AddEdit("x140 y230 w520", g_trackerPath)
    g_reviewGui.AddButton("x672 y228 w68", "Browse").OnEvent("Click", (*) => BrowseDirectory(g_trackerEdit, "Select private tracker repository"))

    g_reviewGui.AddText("x20 y274 w110", "Downloads")
    g_downloadEdit := g_reviewGui.AddEdit("x140 y270 w520", g_downloadDirectory)
    g_reviewGui.AddButton("x672 y268 w68", "Browse").OnEvent("Click", (*) => BrowseDirectory(g_downloadEdit, "Select browser download directory"))

    g_reviewGui.AddText("x20 y314 w110", "Review Lab")
    g_reviewUrlEdit := g_reviewGui.AddEdit("x140 y310 w600", g_reviewLabUrl)

    g_reviewGui.AddText("x20 y358 w110", "Sender export")
    g_senderFileEdit := g_reviewGui.AddEdit("x140 y354 w600 ReadOnly")
    g_reviewGui.AddText("x20 y398 w110", "Receiver export")
    g_receiverFileEdit := g_reviewGui.AddEdit("x140 y394 w600 ReadOnly")
    g_endAfterPush := g_reviewGui.AddCheckBox("x20 y438 w720 Checked", "After a successful tracker push, end only this managed PMIA session")
    g_reviewGui.AddButton("x20 y476 w140 h36", "Export and Pair").OnEvent("Click", ExportAndPair)
    g_reviewGui.AddButton("x172 y476 w190 h36", "Push and Open Review Lab").OnEvent("Click", PushAndOpenReviewLab)
    g_reviewGui.AddButton("x374 y476 w130 h36", "End Session").OnEvent("Click", EndDetectedSession)
    g_reviewGui.AddButton("x620 y476 w120 h36", "Close").OnEvent("Click", CloseReviewStudio)
    g_statusText := g_reviewGui.AddText("x20 y532 w720 h54", "Ready. Detect the active PMIA session first.")
    g_reviewGui.OnEvent("Close", CloseReviewStudio)
    g_reviewGui.Show("w760 h610")
    DetectSessionFromGui()
}

CloseReviewStudio(*) {
    global g_reviewGui, g_statusText, g_sessionText, g_routeText
    if IsObject(g_reviewGui)
        g_reviewGui.Destroy()
    g_reviewGui := 0
    g_statusText := 0
    g_sessionText := 0
    g_routeText := 0
}

BrowseDirectory(control, prompt) {
    selected := DirSelect(control.Value, 3, prompt)
    if selected
        control.Value := selected
}

SetReviewStatus(text, tone := "neutral") {
    global g_statusText
    if !IsObject(g_statusText)
        return
    color := tone = "ok" ? "2F6F68" : tone = "error" ? "A33A32" : tone = "warn" ? "9A641A" : "243447"
    g_statusText.SetFont("c" color)
    g_statusText.Text := text
    Sleep 20
}
DetectSessionFromGui(*) {
    global g_detectedSession, g_pairedExport, g_sessionText, g_routeText
    global g_senderFileEdit, g_receiverFileEdit
    result := DetectManagedSession()
    if !result["ok"] {
        g_detectedSession := Map()
        g_pairedExport := Map()
        g_sessionText.Text := "Session: not detected"
        g_routeText.Text := "Route: -"
        g_senderFileEdit.Value := ""
        g_receiverFileEdit.Value := ""
        SetReviewStatus(result["error"], "error")
        return false
    }
    g_detectedSession := result
    g_pairedExport := Map()
    g_sessionText.Text := "Session: " result["sessionId"]
    g_routeText.Text := "Route: " StrTitle(result["senderProvider"]) " -> " StrTitle(result["receiverProvider"])
    g_senderFileEdit.Value := ""
    g_receiverFileEdit.Value := ""
    SetReviewStatus("Detected one complete READY sender/receiver pair.", "ok")
    return true
}

DetectManagedSession() {
    sessions := Map()
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try {
        for hwnd in WinGetList("ahk_exe msedge.exe") {
            title := WinGetTitle("ahk_id " hwnd)
            if !RegExMatch(title, "^PMIA_(?:BOOT_|REGISTERED_)?(SENDER|RECEIVER)_(CHATGPT|CLAUDE)_(PMIA_[A-Z0-9_]+)$", &match)
                continue
            if InStr(title, "PMIA_BOOT_") = 1 || InStr(title, "PMIA_REGISTERED_") = 1
                continue
            role := StrLower(match[1])
            provider := StrLower(match[2])
            sessionId := StrLower(match[3])
            if !sessions.Has(sessionId) {
                sessions[sessionId] := Map(
                    "sessionId", sessionId,
                    "senderCount", 0, "receiverCount", 0,
                    "senderHwnd", 0, "receiverHwnd", 0,
                    "senderProvider", "", "receiverProvider", "")
            }
            entry := sessions[sessionId]
            entry[role "Count"] += 1
            entry[role "Hwnd"] := hwnd
            entry[role "Provider"] := provider
        }
    } finally {
        DetectHiddenWindows previousDetectHidden
    }
    complete := []
    ambiguous := false
    for sessionId, entry in sessions {
        if entry["senderCount"] > 1 || entry["receiverCount"] > 1
            ambiguous := true
        if entry["senderCount"] = 1 && entry["receiverCount"] = 1
            complete.Push(entry)
    }
    if ambiguous
        return Map("ok", false, "error", "Duplicate managed role windows exist. End stale PMIA sessions before review.")
    if complete.Length = 0
        return Map("ok", false, "error", "No complete READY PMIA sender/receiver pair is running.")
    if complete.Length > 1
        return Map("ok", false, "error", "More than one complete PMIA session is running. End the sessions you do not want to export.")
    result := complete[1]
    result["ok"] := true
    result["error"] := ""
    return result
}

FindRuntimeControlWindow() {
    global PMIA_RUNTIME_CONTROL_WINDOW
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try return WinExist(PMIA_RUNTIME_CONTROL_WINDOW)
    finally DetectHiddenWindows previousDetectHidden
}

SendRuntimeControl(command) {
    global PMIA_RUNTIME_CONTROL_MESSAGE
    hwnd := FindRuntimeControlWindow()
    if !hwnd
        return false
    messageId := DllCall("RegisterWindowMessage", "Str", PMIA_RUNTIME_CONTROL_MESSAGE, "UInt")
    if !messageId
        return false
    return DllCall("PostMessage", "Ptr", hwnd, "UInt", messageId, "Ptr", command, "Ptr", 0) != 0
}

TemporaryResultPath(kind) {
    return A_Temp "\pmia-review-" kind "-" A_TickCount "-" Random(1000, 9999) ".json"
}

CommandQuote(value) {
    quote := Chr(34)
    if InStr(value, quote)
        throw Error("A command path contains an unsupported quote character.")
    return quote value quote
}

JsonString(json, key, defaultValue := "") {
    pattern := '"' key '"\s*:\s*"((?:\\.|[^"])*)"'
    if !RegExMatch(json, pattern, &match)
        return defaultValue
    return DecodeJsonString(match[1])
}

DecodeJsonString(value) {
    decoded := ""
    slash := Chr(92)
    length := StrLen(value)
    index := 1
    while index <= length {
        char := SubStr(value, index, 1)
        if char != slash {
            decoded .= char
            index += 1
            continue
        }
        if index = length {
            decoded .= slash
            break
        }
        escaped := SubStr(value, index + 1, 1)
        switch escaped {
            case '"', slash, '/':
                decoded .= escaped
                index += 2
            case 'b':
                decoded .= Chr(8)
                index += 2
            case 'f':
                decoded .= Chr(12)
                index += 2
            case 'n':
                decoded .= "`n"
                index += 2
            case 'r':
                decoded .= "`r"
                index += 2
            case 't':
                decoded .= "`t"
                index += 2
            case 'u':
                hex := SubStr(value, index + 2, 4)
                if StrLen(hex) = 4 && RegExMatch(hex, "^[0-9A-Fa-f]{4}$") {
                    decoded .= Chr("0x" hex)
                    index += 6
                } else {
                    decoded .= slash escaped
                    index += 2
                }
            default:
                decoded .= slash escaped
                index += 2
        }
    }
    return decoded
}

JsonBoolean(json, key, defaultValue := false) {
    pattern := '"' key '"\s*:\s*(true|false)'
    if !RegExMatch(json, pattern, &match)
        return defaultValue
    return match[1] = "true"
}

ReadJsonResult(path) {
    if !FileExist(path)
        return Map("ok", false, "error", "The operation did not create a result file.")
    json := FileRead(path, "UTF-8")
    result := Map("ok", JsonBoolean(json, "ok", false))
    for key in ["sessionId", "sourceSessionId", "senderFile", "receiverFile",
        "senderProvider", "receiverProvider", "sessionFolder", "trackerRelativePath",
        "branch", "error"]
        result[key] := JsonString(json, key, "")
    result["dryRun"] := JsonBoolean(json, "dryRun", false)
    result["autoMerged"] := JsonBoolean(json, "autoMerged", false)
    return result
}

DeleteOwnTemp(path) {
    if FileExist(path)
        try FileDelete path
}
ExportAndPair(*) {
    global PMIA_RUNTIME_CONTROL_EXPORT, ResolverScript
    global g_detectedSession, g_pairedExport, g_downloadEdit
    global g_senderFileEdit, g_receiverFileEdit
    if !g_detectedSession.Count && !DetectSessionFromGui()
        return false
    if !FileExist(ResolverScript) {
        SetReviewStatus("Export resolver is missing: " ResolverScript, "error")
        return false
    }
    if !DirExist(g_downloadEdit.Value) {
        SetReviewStatus("Download directory does not exist.", "error")
        return false
    }

    SaveReviewPreferences()
    resultPath := TemporaryResultPath("pair")
    sinceUtc := FormatTime(DateAdd(A_NowUTC, -2, "Seconds"), "yyyy-MM-ddTHH:mm:ssZ")
    SetReviewStatus("Requesting sender and receiver exports...", "neutral")
    if !SendRuntimeControl(PMIA_RUNTIME_CONTROL_EXPORT) {
        SetReviewStatus("The PMIA launcher control channel is not available.", "error")
        return false
    }

    command := "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " CommandQuote(ResolverScript)
        . " -DownloadDirectory " CommandQuote(g_downloadEdit.Value)
        . " -SessionId " CommandQuote(g_detectedSession["sessionId"])
        . " -SinceUtc " CommandQuote(sinceUtc)
        . " -WaitSeconds 30 -ResultJsonPath " CommandQuote(resultPath)
    exitCode := RunWait(command, , "Hide")
    result := ReadJsonResult(resultPath)
    DeleteOwnTemp(resultPath)
    if (exitCode != 0 || !result["ok"]) {
        SetReviewStatus(result["error"] != "" ? result["error"] : "Export pairing failed.", "error")
        return false
    }
    if StrLower(result["sessionId"]) != StrLower(g_detectedSession["sessionId"]) {
        SetReviewStatus("The paired files belong to a different PMIA session.", "error")
        return false
    }
    g_pairedExport := result
    g_senderFileEdit.Value := result["senderFile"]
    g_receiverFileEdit.Value := result["receiverFile"]
    SetReviewStatus("Paired fresh sender and receiver Markdown exports.", "ok")
    return true
}

NormalizeMetadata(value, fallback) {
    value := Trim(value)
    return value = "" ? fallback : value
}

BuildPushCommand(resultPath) {
    global PushScript, g_sessionTypeDdl, g_companyEdit, g_roleEdit, g_roundEdit, g_modeEdit
    global g_pairedExport, g_trackerEdit
    return "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " CommandQuote(PushScript)
        . " -SessionType " CommandQuote(g_sessionTypeDdl.Text)
        . " -Company " CommandQuote(NormalizeMetadata(g_companyEdit.Value, "unknown"))
        . " -Role " CommandQuote(NormalizeMetadata(g_roleEdit.Value, "pm"))
        . " -Round " CommandQuote(NormalizeMetadata(g_roundEdit.Value, "unknown"))
        . " -Mode " CommandQuote(NormalizeMetadata(g_modeEdit.Value, "mock"))
        . " -Win1File " CommandQuote(g_pairedExport["senderFile"])
        . " -Win2File " CommandQuote(g_pairedExport["receiverFile"])
        . " -TrackerRepoPath " CommandQuote(g_trackerEdit.Value)
        . " -ResultJsonPath " CommandQuote(resultPath)
}

BuildReviewPrompt(result) {
    senderPath := result["sessionFolder"] "\win1_sender.md"
    receiverPath := result["sessionFolder"] "\win2_receiver.md"
    return "Review this PM interview session using exactly the two files below.`n`n"
        . "Tracker session: " result["trackerRelativePath"] "`n"
        . "Sender record: " senderPath "`n"
        . "Receiver record: " receiverPath "`n`n"
        . "Give a scorecard, truth risks, weak answers, transcript/transport issues, recurring-pattern candidates, and the top three actions before the next interview. Classify changes as session-only coaching, repeated-pattern candidate, or urgent system fix."
}
PushAndOpenReviewLab(*) {
    global PushScript, g_pairedExport, g_trackerEdit, g_reviewUrlEdit, g_endAfterPush
    global PMIA_RUNTIME_CONTROL_END
    if !g_pairedExport.Count && !ExportAndPair()
        return false
    if !FileExist(PushScript) {
        SetReviewStatus("Tracker push script is missing: " PushScript, "error")
        return false
    }
    if !DirExist(g_trackerEdit.Value) {
        SetReviewStatus("Tracker repository does not exist.", "error")
        return false
    }

    SaveReviewPreferences()
    resultPath := TemporaryResultPath("push")
    SetReviewStatus("Validating and pushing the session to the private tracker...", "neutral")
    exitCode := RunWait(BuildPushCommand(resultPath), , "Hide")
    result := ReadJsonResult(resultPath)
    DeleteOwnTemp(resultPath)
    if (exitCode != 0 || !result["ok"]) {
        SetReviewStatus(result["error"] != "" ? result["error"] : "Tracker push failed. The interview session remains open.", "error")
        return false
    }

    A_Clipboard := BuildReviewPrompt(result)
    Run 'explorer.exe ' CommandQuote(result["sessionFolder"])
    if !OpenReviewLab(g_reviewUrlEdit.Value) {
        SetReviewStatus("Session pushed, but Review Lab could not be opened. The review prompt is on the clipboard.", "warn")
        return true
    }

    SetReviewStatus("Session pushed. Review Lab and the local session folder are open; the review prompt is copied.", "ok")
    if g_endAfterPush.Value {
        Sleep 250
        if SendRuntimeControl(PMIA_RUNTIME_CONTROL_END)
            SetReviewStatus("Session pushed and the exact managed PMIA session was asked to close.", "ok")
        else
            SetReviewStatus("Session pushed, but the PMIA launcher control channel was unavailable. Close the session with Alt+Delete.", "warn")
    }
    return true
}

OpenReviewLab(url) {
    global BrowserExe, MainSettingsFile
    url := Trim(url)
    if !FileExist(BrowserExe) || !RegExMatch(url, "^https://chatgpt\.com/")
        return false
    profile := IniRead(MainSettingsFile, "Studio", "ProfileDirectory", "Default")
    Run CommandQuote(BrowserExe) " --profile-directory=" CommandQuote(profile) " " CommandQuote(url)
    return true
}
EndDetectedSession(*) {
    global PMIA_RUNTIME_CONTROL_END, g_detectedSession, g_pairedExport
    if !g_detectedSession.Count && !DetectSessionFromGui()
        return false
    if !SendRuntimeControl(PMIA_RUNTIME_CONTROL_END) {
        SetReviewStatus("The PMIA launcher control channel is unavailable. Use Alt+Delete in the main runtime.", "error")
        return false
    }
    g_detectedSession := Map()
    g_pairedExport := Map()
    SetReviewStatus("Exact managed PMIA session close requested.", "ok")
    return true
}
