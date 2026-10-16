#Requires AutoHotkey v2.0
#SingleInstance Force
#Warn All, StdOut

; PMIA 0.12.1 optional convenience launcher. Question delivery is extension-only.
if (EnvGet("PMIA_VALIDATE") = "1" || (A_Args.Length >= 1 && A_Args[1] = "--validate")) {
    FileAppend "AHK_VALID`n", "*"
    ExitApp 0
}
OpenStudio(*) {
    launcher := A_ScriptDir "\Launch_PMIA_Studio.ps1"
    if !FileExist(launcher) {
        MsgBox "PMIA launcher not found: " launcher, "PMIA", "Iconx"
        return
    }
    quote := Chr(34)
    command := "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " quote launcher quote
    try {
        Run command
    } catch as err {
        MsgBox "PMIA Studio could not open.`n`n" err.Message, "PMIA", "Iconx"
    }
}
!r::OpenStudio()
OpenStudio()
