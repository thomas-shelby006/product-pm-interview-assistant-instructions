#Requires AutoHotkey v2.0
#SingleInstance Off
#Warn All, StdOut

global SETTINGS_DIR := A_Temp "\pmia-platform-smoke-" A_TickCount
global RUNTIME_CONTROL_MESSAGE_NAME := "PMIA_RUNTIME_CONTROL_SMOKE"
global RUNTIME_CONTROL_WINDOW_TITLE := "PMIA_RUNTIME_CONTROL_SMOKE"
global RUNTIME_CONTROL_ACTIVATE := 3

SetPmiaRuntimeSettingsDir(SETTINGS_DIR)
ExitApp(RunPlatformSmoke())

AssertPlatform(condition, message) {
    if !condition
        throw Error("PLATFORM_SMOKE_FAIL: " message)
}

DestroyOwnedSmokeWindow(guiObj, *) {
    guiObj.Destroy()
}

RunPlatformSmoke() {
    global SETTINGS_DIR
    ownedWindow := 0
    unrelated := 0
    try {
        DirCreate SETTINGS_DIR
        AssertPlatform(NormalizeBrowserFamily("CHROME") = "chrome", "browser family normalization")
        AssertPlatform(NormalizeBrowserFamily("unknown") = "edge", "browser family fallback")
        flags := NormalizeBrowserExtraFlags("--disable-gpu --no-sandbox --remote-debugging-port=9222 --disable-features=Unsafe --lang=en-US")
        AssertPlatform(InStr(flags, "--disable-gpu") > 0, "safe flag preserved")
        AssertPlatform(InStr(flags, "--lang=en-US") > 0, "safe valued flag preserved")
        AssertPlatform(InStr(flags, "no-sandbox") = 0, "unsafe sandbox flag removed")
        AssertPlatform(InStr(flags, "remote-debugging") = 0, "remote debugging flag removed")
        AssertPlatform(InStr(flags, "disable-features=Unsafe") = 0, "managed feature flags cannot be overridden")

        config := Map("family", "chrome", "executable", A_AhkPath, "userDataRoot", SETTINGS_DIR, "extraFlags", flags)
        built := BuildPmiaBrowserFlags(config, "Profile 1")
        expectedProfileFlag := "--profile-directory=" Chr(34) "Profile 1" Chr(34)
        AssertPlatform(InStr(built, expectedProfileFlag) > 0, "profile flag built")
        AssertPlatform(InStr(built, "--disable-background-timer-throttling") > 0, "latency flag built")
        AssertPlatform(InStr(built, "--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling") > 0, "managed feature flags built")
        AssertPlatform(BrowserExtensionsUrl(config, "abc") = "chrome://extensions/?id=abc", "browser extensions URL")

        ownedWindow := Gui("+ToolWindow", "PMIA_SENDER_CHATGPT_PMIA_SMOKE")
        ownedWindow.OnEvent("Close", DestroyOwnedSmokeWindow)
        ownedWindow.Show("x-32000 y-32000 w120 h80 NoActivate")
        ownedWindow.Hide()
        ownedHwnd := ownedWindow.Hwnd
        AssertPlatform(ManagedWindowExists(ownedHwnd), "owned window created")
        AssertPlatform(ManagedWindowMatchesOwnership(ownedHwnd, "pmia_smoke", A_AhkPath), "owned window recognized")
        AssertPlatform(!ManagedWindowMatchesOwnership(ownedHwnd, "other_session", A_AhkPath), "wrong session rejected")
        AssertPlatform(CloseExactManagedWindow(ownedHwnd, "pmia_smoke", A_AhkPath), "owned window closes exactly")
        AssertPlatform(!ManagedWindowExists(ownedHwnd), "owned window remains closed")

        unrelated := Gui("+ToolWindow", "UNRELATED_WINDOW")
        unrelated.Show("Hide w120 h80")
        WriteManagedRuntimeJournal("pmia_smoke", config, unrelated.Hwnd, 0, 0, 201, 0, 0)
        journal := ReadManagedRuntimeJournal()
        AssertPlatform(journal["senderPid"] = 201, "journal process metadata")
        blocked := CloseOwnedManagedRuntime("pmia_smoke")
        AssertPlatform(!blocked["ok"] && blocked["reason"] = "window_ownership_mismatch", "unrelated window cleanup blocked")
        AssertPlatform(ManagedWindowExists(unrelated.Hwnd), "unrelated window remains open")
        FileAppend "AHK_VALID`n", "*"
        return 0
    } catch as caughtError {
        FileAppend "PLATFORM_SMOKE_EXCEPTION: " caughtError.Message "`n", "*"
        return 8
    } finally {
        if IsObject(unrelated)
            try unrelated.Destroy()
        if IsObject(ownedWindow)
            try ownedWindow.Destroy()
        try FileDelete ManagedRuntimeJournalPath()
        try DirDelete SETTINGS_DIR
    }
}

#Include %A_ScriptDir%\PMIA_Runtime_Platform.ahk
