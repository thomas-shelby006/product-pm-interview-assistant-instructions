param(
    [Parameter(Mandatory=$false)]
    [string]$AhkPath = "runtime\Final_2_Window_Fixed.ahk"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectUrl = "https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project"

if (-not (Test-Path -LiteralPath $AhkPath -PathType Leaf)) {
    throw "AHK file not found: $AhkPath"
}

$content = [System.IO.File]::ReadAllText($AhkPath)
$original = $content

function Replace-Required {
    param(
        [Parameter(Mandatory=$true)][string]$Text,
        [Parameter(Mandatory=$true)][string]$Old,
        [Parameter(Mandatory=$true)][string]$New,
        [Parameter(Mandatory=$true)][string]$Label
    )
    if (-not $Text.Contains($Old)) {
        throw "Required text not found for replacement: $Label"
    }
    return $Text.Replace($Old, $New)
}

# 1. Add project URL constants after BrowserExe, idempotently.
if ($content -notmatch 'global\s+PM_HELPER_PROJECT_URL\s*:=') {
    $old = 'global BrowserExe := "C:\Program Files (x86)\Microsoft\Edge Beta\Application\msedge.exe"'
    $new = @'
global BrowserExe := "C:\Program Files (x86)\Microsoft\Edge Beta\Application\msedge.exe"

; Default ChatGPT Project targets.
; PM_HELPER_PROJECT_URL is used by Alt+R for the live two-window PM helper runtime.
; REVIEW_LAB_PROJECT_URL is intentionally blank until the PM Interview Review Lab Project is created.
global PM_HELPER_PROJECT_URL := "https://chatgpt.com/g/g-p-6a07471553dc8191a30e48a421c843aa-pm-interview-helper/project"
global REVIEW_LAB_PROJECT_URL := ""
'@
    $content = Replace-Required -Text $content -Old $old -New $new -Label "BrowserExe constants block"
}

# 2. Add PM_HELPER_PROJECT_URL to AutoStartup globals, idempotently.
if ($content -notmatch 'global\s+g_hWin1,\s*g_hWin2,\s*BrowserExe,\s*PM_HELPER_PROJECT_URL,\s*g_interviewActive') {
    $content = Replace-Required `
        -Text $content `
        -Old '    global g_hWin1, g_hWin2, BrowserExe, g_interviewActive' `
        -New '    global g_hWin1, g_hWin2, BrowserExe, PM_HELPER_PROJECT_URL, g_interviewActive' `
        -Label "AutoStartup global line"
}

# 3. Replace generic ChatGPT launch URLs with PM Helper Project URL + role, idempotently.
if ($content.Contains('    Run BrowserExe '' --app="https://chatgpt.com/?vb_role=sender"'' . flags')) {
    $old = @'
    Run BrowserExe ' --app="https://chatgpt.com/?vb_role=sender"' . flags
    Run BrowserExe ' --app="https://chatgpt.com/?vb_role=receiver"' . flags
'@
    $new = @'
    senderUrl := UrlWithRole(PM_HELPER_PROJECT_URL, "sender")
    receiverUrl := UrlWithRole(PM_HELPER_PROJECT_URL, "receiver")

    Run BrowserExe ' --app="' senderUrl '"' . flags
    Run BrowserExe ' --app="' receiverUrl '"' . flags
'@
    $content = Replace-Required -Text $content -Old $old -New $new -Label "AutoStartup launch URL block"
}

# 4. Add UrlWithRole helper after AutoStartup(), idempotently.
if ($content -notmatch 'UrlWithRole\(baseUrl,\s*role\)') {
    $old = @'
    WinActivate "ahk_id " g_hWin2
}

EnsureAlwaysOnTop(hwnd) {
'@
    $new = @'
    WinActivate "ahk_id " g_hWin2
}

UrlWithRole(baseUrl, role) {
    sep := InStr(baseUrl, "?") ? "&" : "?"
    return baseUrl . sep . "vb_role=" . role
}

EnsureAlwaysOnTop(hwnd) {
'@
    $content = Replace-Required -Text $content -Old $old -New $new -Label "UrlWithRole helper insertion point"
}

if ($content -eq $original) {
    Write-Host "No changes needed. Project URL default already appears to be applied."
    exit 0
}

[System.IO.File]::WriteAllText($AhkPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Updated $AhkPath to open PM Interview Helper Project URL by default."
Write-Host "Project URL: $projectUrl"
