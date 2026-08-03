; PMIA runtime platform owner: single instance, browser config and exact managed-window journal.

PmiaRuntimePlatformState() {
    static state := Map(
        "mutexName", "Local\PMIA_ProductInterviewAssistant_Runtime",
        "settingsDir", EnvGet("LOCALAPPDATA") "\PMInterviewAssistant",
        "mutexHandle", 0
    )
    return state
}

EnsurePmiaRuntimeOwnership(controlMessageName, controlWindowTitle, activateCode) {
    state := PmiaRuntimePlatformState()
    controlMessageName := String(controlMessageName || '')
    controlWindowTitle := String(controlWindowTitle || '')
    activateCode := Integer(activateCode || 0)
    if (controlMessageName = '' || controlWindowTitle = '' || !activateCode)
        throw Error("PMIA runtime ownership requires an explicit control channel")
    handle := DllCall("CreateMutexW", "Ptr", 0, "Int", 0, "Str", state["mutexName"], "Ptr")
    if !handle
        throw Error("Could not create PMIA runtime ownership mutex")
    if (A_LastError = 183) {
        messageId := DllCall("RegisterWindowMessageW", "Str", controlMessageName, "UInt")
        previousDetectHidden := A_DetectHiddenWindows
        DetectHiddenWindows true
        try {
            deadline := A_TickCount + 2500
            while (A_TickCount < deadline) {
                existing := WinExist(controlWindowTitle)
                if existing {
                    try PostMessage messageId, activateCode, 0, , "ahk_id " existing
                    break
                }
                Sleep 50
            }
        } finally DetectHiddenWindows previousDetectHidden
        DllCall("CloseHandle", "Ptr", handle)
        ExitApp 0
    }
    state["mutexHandle"] := handle
    OnExit ReleasePmiaRuntimeOwnership
    return true
}

ReleasePmiaRuntimeOwnership(*) {
    state := PmiaRuntimePlatformState()
    handle := Integer(state["mutexHandle"] || 0)
    if handle {
        DllCall("CloseHandle", "Ptr", handle)
        state["mutexHandle"] := 0
    }
}

NormalizeBrowserFamily(value) {
    value := StrLower(Trim(value))
    return (value = "chrome" || value = "brave" || value = "vivaldi") ? value : "edge"
}

DefaultBrowserExecutable(family) {
    family := NormalizeBrowserFamily(family)
    candidates := family = "chrome"
        ? [EnvGet("ProgramFiles") "\Google\Chrome\Application\chrome.exe", EnvGet("ProgramFiles(x86)") "\Google\Chrome\Application\chrome.exe"]
        : family = "brave"
            ? [EnvGet("ProgramFiles") "\BraveSoftware\Brave-Browser\Application\brave.exe", EnvGet("ProgramFiles(x86)") "\BraveSoftware\Brave-Browser\Application\brave.exe"]
            : family = "vivaldi"
                ? [EnvGet("LOCALAPPDATA") "\Vivaldi\Application\vivaldi.exe", EnvGet("ProgramFiles") "\Vivaldi\Application\vivaldi.exe"]
                : [EnvGet("ProgramFiles(x86)") "\Microsoft\Edge\Application\msedge.exe", EnvGet("ProgramFiles") "\Microsoft\Edge\Application\msedge.exe"]
    for candidate in candidates
        if FileExist(candidate)
            return candidate
    return candidates[1]
}

DefaultBrowserUserDataRoot(family) {
    family := NormalizeBrowserFamily(family)
    if (family = "chrome")
        return EnvGet("LOCALAPPDATA") "\Google\Chrome\User Data"
    if (family = "brave")
        return EnvGet("LOCALAPPDATA") "\BraveSoftware\Brave-Browser\User Data"
    if (family = "vivaldi")
        return EnvGet("LOCALAPPDATA") "\Vivaldi\User Data"
    return EnvGet("LOCALAPPDATA") "\Microsoft\Edge\User Data"
}

NormalizeBrowserExtraFlags(value) {
    blocked := ["--no-sandbox", "--disable-web-security", "--ignore-certificate-errors", "--remote-debugging", "--user-data-dir", "--profile-directory", "--load-extension", "--disable-extensions", "--disable-features", "--enable-features"]
    output := ""
    for token in StrSplit(Trim(value), A_Space) {
        token := Trim(token)
        if (token = "" || !RegExMatch(token, "^--[A-Za-z0-9_-]+(?:=.*)?$"))
            continue
        unsafe := false
        for prefix in blocked
            if InStr(StrLower(token), prefix) = 1 {
                unsafe := true
                break
            }
        if !unsafe
            output .= " " token
    }
    return output
}

LoadBrowserRuntimeConfig(settingsFile) {
    family := NormalizeBrowserFamily(IniRead(settingsFile, "Browser", "Family", "edge"))
    executable := Trim(IniRead(settingsFile, "Browser", "Executable", ""))
    if (executable = "" || !FileExist(executable))
        executable := DefaultBrowserExecutable(family)
    userDataRoot := Trim(IniRead(settingsFile, "Browser", "UserDataRoot", ""))
    if (userDataRoot = "" || !DirExist(userDataRoot))
        userDataRoot := DefaultBrowserUserDataRoot(family)
    extraFlags := NormalizeBrowserExtraFlags(IniRead(settingsFile, "Browser", "ExtraFlags", ""))
    return Map("family", family, "executable", executable, "userDataRoot", userDataRoot, "extraFlags", extraFlags)
}

SaveBrowserRuntimeConfig(settingsFile, config) {
    IniWrite config["family"], settingsFile, "Browser", "Family"
    IniWrite config["executable"], settingsFile, "Browser", "Executable"
    IniWrite config["userDataRoot"], settingsFile, "Browser", "UserDataRoot"
    IniWrite config["extraFlags"], settingsFile, "Browser", "ExtraFlags"
}

BuildPmiaBrowserFlags(config, profileDirectory) {
    flags := " --profile-directory=" Chr(34) profileDirectory Chr(34) " --no-first-run --no-default-browser-check --disable-session-crashed-bubble --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling"
    return flags config["extraFlags"]
}

BrowserExtensionsUrl(config, extensionId := "") {
    family := config["family"]
    scheme := family = "edge" ? "edge" : family = "brave" ? "brave" : family = "vivaldi" ? "vivaldi" : "chrome"
    return scheme "://extensions/" (extensionId != "" ? "?id=" extensionId : "")
}

LaunchPmiaBrowserWindow(config, profileDirectory, url, &pid := 0) {
    command := '"' config["executable"] '" --new-window --app="' url '"' BuildPmiaBrowserFlags(config, profileDirectory)
    Run command, , , &pid
    return pid
}

LaunchPmiaBrowserPage(config, profileDirectory, url, &pid := 0) {
    command := '"' config["executable"] '" --new-window "' url '"' BuildPmiaBrowserFlags(config, profileDirectory)
    Run command, , , &pid
    return pid
}

SnapshotBrowserWindows(config) {
    windows := Map()
    executableName := RegExReplace(config["executable"], "^.*\\", "")
    if (executableName = "")
        return windows
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try {
        for hwnd in WinGetList("ahk_exe " executableName)
            windows[hwnd] := true
    } finally DetectHiddenWindows previousDetectHidden
    return windows
}

WaitForNewBrowserWindow(config, before, timeoutMs := 3500) {
    executableName := RegExReplace(config["executable"], "^.*\\", "")
    if (executableName = "")
        return 0
    deadline := A_TickCount + Max(0, timeoutMs)
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try {
        loop {
            for hwnd in WinGetList("ahk_exe " executableName) {
                if before.Has(hwnd)
                    continue
                processPath := ""
                try processPath := WinGetProcessPath("ahk_id " hwnd)
                if (processPath = "" || StrLower(processPath) = StrLower(config["executable"]))
                    return hwnd
            }
            if (A_TickCount >= deadline)
                return 0
            Sleep 25
        }
    } finally DetectHiddenWindows previousDetectHidden
}

SetPmiaRuntimeSettingsDir(value) {
    state := PmiaRuntimePlatformState()
    normalized := RTrim(String(value || ''), "\/")
    if (normalized = '')
        throw Error("PMIA runtime settings directory is required")
    state["settingsDir"] := normalized
    return normalized
}

ManagedRuntimeJournalPath() {
    state := PmiaRuntimePlatformState()
    return state["settingsDir"] "\managed-runtime.ini"
}

WriteManagedRuntimeJournal(sessionId, browserConfig, senderHwnd := 0, receiverHwnd := 0, dashboardHwnd := 0, senderPid := 0, receiverPid := 0, dashboardPid := 0) {
    path := ManagedRuntimeJournalPath()
    DirCreate StrReplace(path, "\managed-runtime.ini", "")
    IniWrite sessionId, path, "Runtime", "SessionId"
    IniWrite browserConfig["family"], path, "Runtime", "BrowserFamily"
    IniWrite browserConfig["executable"], path, "Runtime", "BrowserExecutable"
    IniWrite senderHwnd, path, "Runtime", "SenderHwnd"
    IniWrite receiverHwnd, path, "Runtime", "ReceiverHwnd"
    IniWrite dashboardHwnd, path, "Runtime", "DashboardHwnd"
    IniWrite senderPid, path, "Runtime", "SenderPid"
    IniWrite receiverPid, path, "Runtime", "ReceiverPid"
    IniWrite dashboardPid, path, "Runtime", "DashboardPid"
    IniWrite A_NowUTC, path, "Runtime", "UpdatedAt"
    return path
}

ReadManagedRuntimeJournal() {
    path := ManagedRuntimeJournalPath()
    if !FileExist(path)
        return Map()
    return Map(
        "sessionId", IniRead(path, "Runtime", "SessionId", ""),
        "browserFamily", IniRead(path, "Runtime", "BrowserFamily", "edge"),
        "browserExecutable", IniRead(path, "Runtime", "BrowserExecutable", ""),
        "senderHwnd", Integer(IniRead(path, "Runtime", "SenderHwnd", "0")),
        "receiverHwnd", Integer(IniRead(path, "Runtime", "ReceiverHwnd", "0")),
        "dashboardHwnd", Integer(IniRead(path, "Runtime", "DashboardHwnd", "0")),
        "senderPid", Integer(IniRead(path, "Runtime", "SenderPid", "0")),
        "receiverPid", Integer(IniRead(path, "Runtime", "ReceiverPid", "0")),
        "dashboardPid", Integer(IniRead(path, "Runtime", "DashboardPid", "0"))
    )
}

ManagedWindowExists(hwnd) {
    hwnd := Integer(hwnd || 0)
    if !hwnd
        return false
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try return WinExist("ahk_id " hwnd) ? true : false
    finally DetectHiddenWindows previousDetectHidden
}

ManagedWindowMatchesOwnership(hwnd, sessionId, browserExecutable := "") {
    hwnd := Integer(hwnd || 0)
    if !hwnd || !ManagedWindowExists(hwnd)
        return true
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try {
        title := WinGetTitle("ahk_id " hwnd)
        processPath := ""
        try processPath := WinGetProcessPath("ahk_id " hwnd)
        if (sessionId = "" || !InStr(title, "PMIA_") || !InStr(title, sessionId))
            return false
        if (browserExecutable != "" && processPath != "" && StrLower(processPath) != StrLower(browserExecutable))
            return false
        return true
    } finally DetectHiddenWindows previousDetectHidden
}

CloseExactManagedWindow(hwnd, sessionId, browserExecutable := "", waitMs := 2500) {
    hwnd := Integer(hwnd || 0)
    if !hwnd || !ManagedWindowExists(hwnd)
        return true
    if !ManagedWindowMatchesOwnership(hwnd, sessionId, browserExecutable)
        return false
    previousDetectHidden := A_DetectHiddenWindows
    DetectHiddenWindows true
    try {
        try WinClose "ahk_id " hwnd
        deadline := A_TickCount + waitMs
        while (A_TickCount < deadline && WinExist("ahk_id " hwnd))
            Sleep 50
        if WinExist("ahk_id " hwnd) && ManagedWindowMatchesOwnership(hwnd, sessionId, browserExecutable)
            try WinKill "ahk_id " hwnd
        return !WinExist("ahk_id " hwnd)
    } finally DetectHiddenWindows previousDetectHidden
}

CloseOwnedManagedRuntime(sessionId := "") {
    journal := ReadManagedRuntimeJournal()
    if !journal.Count
        return Map("ok", true, "closed", 0, "reason", "journal_missing")
    journalSession := journal["sessionId"]
    if (sessionId != "" && journalSession != sessionId)
        return Map("ok", false, "closed", 0, "reason", "journal_session_mismatch")
    closed := 0
    mismatched := 0
    for key in ["senderHwnd", "receiverHwnd", "dashboardHwnd"] {
        hwnd := journal[key]
        if !hwnd || !ManagedWindowExists(hwnd)
            continue
        if CloseExactManagedWindow(hwnd, journalSession, journal["browserExecutable"])
            closed += 1
        else
            mismatched += 1
    }
    if mismatched
        return Map("ok", false, "closed", closed, "reason", "window_ownership_mismatch", "mismatched", mismatched)
    path := ManagedRuntimeJournalPath()
    try FileDelete path
    return Map("ok", true, "closed", closed, "reason", "exact_windows_closed")
}

UpdateManagedRuntimeJournal(sessionId, browserConfig, senderHwnd := 0, receiverHwnd := 0, dashboardHwnd := 0, senderPid := 0, receiverPid := 0, dashboardPid := 0) {
    return WriteManagedRuntimeJournal(sessionId, browserConfig, senderHwnd, receiverHwnd, dashboardHwnd, senderPid, receiverPid, dashboardPid)
}
