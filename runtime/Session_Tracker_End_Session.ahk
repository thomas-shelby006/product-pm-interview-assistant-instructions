#Requires AutoHotkey v2.0
#SingleInstance Force

; Companion helper. Does not replace Final_2_Window_Fixed.ahk.
; Alt+Shift+E opens the end-session panel.
; After a successful push, it can send the main runtime's Alt+Delete exit hotkey
; so Alt+Tab returns to normal without using Task Manager.

RepoRoot := A_ScriptDir "\.."
PushScript := RepoRoot "\runtime\scripts\push-session-to-tracker.ps1"

!+e::ShowEndSessionGui()

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

    g.AddText("x16 y228 w120", "Win1 file")
    win1 := g.AddEdit("x150 y224 w420")
    g.AddButton("x580 y222 w80", "Browse").OnEvent("Click", (*) => BrowseFile(win1))

    g.AddText("x16 y266 w120", "Win2 file")
    win2 := g.AddEdit("x150 y262 w420")
    g.AddButton("x580 y260 w80", "Browse").OnEvent("Click", (*) => BrowseFile(win2))

    closeMain := g.AddCheckBox("x16 y304 w640 Checked", "After successful push, close the main PM Interview AHK runtime (restores normal Alt+Tab)")

    g.AddButton("x16 y338 w150", "Export Both Windows").OnEvent("Click", (*) => ExportBothWindows())
    g.AddButton("x180 y338 w150", "Push Session").OnEvent("Click", (*) => PushSession(sessionType, company, role, round, mode, win1, win2, tracker, closeMain))
    g.AddButton("x344 y338 w170", "Copy Review Prompt").OnEvent("Click", (*) => CopyReviewPrompt(sessionType, company, role, round, mode))
    g.AddButton("x528 y338 w90", "Close").OnEvent("Click", (*) => g.Destroy())

    g.AddText("x16 y378 w650", "Export first, then select the downloaded Win1/Win2 markdown files, then push. Old disabled scripts are not deleted by this helper.")
    g.Show("w690 h420")
}

BrowseFolder(ctrl) {
    selected := DirSelect(, 3, "Select tracker repo folder")
    if selected
        ctrl.Value := selected
}

BrowseFile(ctrl) {
    selected := FileSelect(1, A_Desktop, "Select exported markdown file", "Markdown (*.md)")
    if selected
        ctrl.Value := selected
}

ExportBothWindows() {
    for title in ["VB_SENDER", "VB_RECEIVER"] {
        hwnd := WinExist(title)
        if hwnd {
            WinActivate(hwnd)
            Sleep(300)
            Send("^+{F9}")
            Sleep(900)
        }
    }
    MsgBox("Export hotkey sent to Win1/Win2 if found. Check Downloads for the markdown files.")
}

PushSession(sessionType, company, role, round, mode, win1, win2, tracker, closeMain) {
    global PushScript
    if !FileExist(PushScript) {
        MsgBox("Push script not found:`n" PushScript)
        return
    }
    if !FileExist(win1.Value) || !FileExist(win2.Value) {
        MsgBox("Select both Win1 and Win2 markdown files first.")
        return
    }
    cmd := 'powershell.exe -ExecutionPolicy Bypass -File "' PushScript '"'
        . ' -SessionType "' sessionType.Text '"'
        . ' -Company "' company.Value '"'
        . ' -Role "' role.Value '"'
        . ' -Round "' round.Value '"'
        . ' -Mode "' mode.Value '"'
        . ' -Win1File "' win1.Value '"'
        . ' -Win2File "' win2.Value '"'
        . ' -TrackerRepoPath "' tracker.Value '"'
    exitCode := RunWait(cmd, , "Hide")
    if (exitCode = 0) {
        if (closeMain.Value) {
            CloseMainRuntime()
            MsgBox("Session push finished. Main PM Interview AHK runtime close signal sent, so normal Alt+Tab should be restored.")
        } else {
            MsgBox("Session push finished. Main PM Interview AHK runtime was left running.")
        }
    } else {
        MsgBox("Push script exited with code " exitCode ". Main PM Interview AHK runtime was NOT closed. Check PowerShell/Git output.")
    }
}

CloseMainRuntime() {
    ; The main runtime owns Alt+Delete as its safe exit hotkey.
    ; Sending the hotkey is safer than killing AutoHotkey processes by name,
    ; because this companion helper is also an AutoHotkey process.
    Sleep(300)
    Send("!{Delete}")
}

CopyReviewPrompt(sessionType, company, role, round, mode) {
    prompt := "Review the latest PM interview session from the tracker repo.`n`n"
        . "Session type: " sessionType.Text "`n"
        . "Company: " company.Value "`n"
        . "Role: " role.Value "`n"
        . "Round: " round.Value "`n"
        . "Mode: " mode.Value "`n`n"
        . "Use exactly two files: win1_sender.md and win2_receiver.md.`n"
        . "Give scorecard, what went well, what went badly, weak answers, truth risks, blocked transcript issues, Win1/Win2 mismatches, recurring-pattern candidates, and top 3 actions before next session."
    A_Clipboard := prompt
    MsgBox("Review prompt copied to clipboard.")
}
