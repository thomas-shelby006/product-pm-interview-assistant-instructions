#Requires AutoHotkey v2.0
#SingleInstance Force
#Warn All, StdOut

; PMIA 0.12 optional Windows bootstrap.
; Live capture, fan-out, provider submit, layout, and cockpit are extension-owned.

global BrowserExe := "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
global SettingsPath := EnvGet("LOCALAPPDATA") "\PMInterviewAssistant\settings.ini"
global DefaultExtensionId := "cgjddhagnfjdoncphajinaacjfodhpen"

if (EnvGet("PMIA_VALIDATE") = "1" || (A_Args.Length >= 1 && A_Args[1] = "--validate")) {
    FileAppend "AHK_VALID`n", "*"
    ExitApp 0
}

ReadProfileDirectory() {
    global SettingsPath
    try {
        value := Trim(IniRead(SettingsPath, "Runtime", "ProfileDirectory", "Default"))
        return value != "" ? value : "Default"
    } catch {
        return "Default"
    }
}

ReadExtensionId() {
    global DefaultExtensionId, SettingsPath
    fromEnv := Trim(EnvGet("PMIA_EXTENSION_ID"))
    if (fromEnv != "")
        return fromEnv
    try {
        fromSettings := Trim(IniRead(SettingsPath, "Runtime", "ExtensionId", ""))
        if (fromSettings != "")
            return fromSettings
    }
    return DefaultExtensionId
}
OpenStudio(*) {
    global BrowserExe
    profile := ReadProfileDirectory()
    extensionId := ReadExtensionId()
    studioUrl := "chrome-extension://" extensionId "/studio/index.html"
    quote := Chr(34)
    command := quote BrowserExe quote " --profile-directory=" quote profile quote " --new-window " quote studioUrl quote
    try {
        Run command
    } catch as err {
        MsgBox "PMIA Studio could not open.`n`n" err.Message, "PMIA", "Iconx"
    }
}

!r::OpenStudio()
OpenStudio()
