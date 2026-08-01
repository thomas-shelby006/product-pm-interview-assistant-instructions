param(
    [string]$AutoHotkeyExe = "$env:LOCALAPPDATA\Programs\AutoHotkey\v2\AutoHotkey64.exe",
    [string]$GateLog = '',
    [string]$SmokeEvidence = '',
    [string]$EvidenceManifest = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $PSScriptRoot 'extension'
$launcher = Join-Path $PSScriptRoot 'Final_2_Window_Extension.ahk'
$reviewCompanion = Join-Path $PSScriptRoot 'Session_Tracker_End_Session.ahk'
$isolatedSmoke = Join-Path $PSScriptRoot 'scripts\run-isolated-release-smoke.ps1'
$isolatedRunner = Join-Path $PSScriptRoot 'scripts\isolated-release-smoke.mjs'
$evidenceBuilder = Join-Path $PSScriptRoot 'scripts\build-release-evidence-manifest.mjs'

if (-not (Test-Path $AutoHotkeyExe)) { throw "AutoHotkey v2 not found: $AutoHotkeyExe" }
if (-not (Test-Path (Join-Path $extension 'manifest.json'))) { throw 'Extension manifest missing.' }
if (-not (Test-Path $launcher)) { throw 'Extension launcher missing.' }
if (-not (Test-Path $reviewCompanion)) { throw 'Session review companion missing.' }
if (-not (Test-Path $isolatedSmoke)) { throw 'Isolated release smoke PowerShell owner missing.' }
if (-not (Test-Path $isolatedRunner)) { throw 'Isolated release smoke Node runner missing.' }
if (-not (Test-Path $evidenceBuilder)) { throw 'Release evidence manifest builder missing.' }

$launcherSource = Get-Content $launcher -Raw
$requiredHotkeys = @('!r::', '!Esc::', '!Delete::', '!Tab::', '!CapsLock::', '!q::', '!w::', '!e::', '!h::', '!+r::', '!+e::')
foreach ($hotkey in $requiredHotkeys) {
    if (-not $launcherSource.Contains($hotkey)) { throw "Required PM hotkey missing: $hotkey" }
}
$forbiddenHotkeys = @('!s::', '!a::', '!x::', '!1::', '!z::', '!Shift::')
foreach ($hotkey in $forbiddenHotkeys) {
    if ($launcherSource.Contains($hotkey)) { throw "Non-PM hotkey remains active: $hotkey" }
}
if ($launcherSource -match 'promptScreenshot|keybd_event') {
    throw 'Screenshot workflow remains in the active PM launcher.'
}
$reviewSource = Get-Content $reviewCompanion -Raw
foreach ($required in @('PMIA_RUNTIME_CONTROL_V1','resolve-pmia-session-exports.ps1','push-session-to-tracker.ps1')) {
    if (-not $reviewSource.Contains($required)) {
        throw "Session review companion requirement missing: $required"
    }
}
foreach ($legacy in @('VB_SENDER','VB_RECEIVER','Ctrl+Shift+F9','^+{F9}')) {
    if ($reviewSource.Contains($legacy)) {
        throw "Legacy review companion assumption remains active: $legacy"
    }
}

function Test-AutoHotkeyScript(
    [string]$Path,
    [string]$Label,
    [switch]$UseEnvironmentValidation
) {
    $token = [IO.Path]::GetFileNameWithoutExtension($Path) -replace '[^A-Za-z0-9]+','-'
    $stdout = Join-Path $env:TEMP "pmia-ahk-$token-out.txt"
    $stderr = Join-Path $env:TEMP "pmia-ahk-$token-err.txt"
    Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue
    $previousValidation = $env:PMIA_VALIDATE
    try {
        if ($UseEnvironmentValidation) { $env:PMIA_VALIDATE = '1' }
        $arguments = @('/ErrorStdOut', ('"' + $Path + '"'))
        if (-not $UseEnvironmentValidation) { $arguments += '--validate' }
        $process = Start-Process $AutoHotkeyExe -ArgumentList $arguments `
            -RedirectStandardOutput $stdout -RedirectStandardError $stderr -Wait -PassThru
    } finally {
        if ($null -eq $previousValidation) { Remove-Item Env:PMIA_VALIDATE -ErrorAction SilentlyContinue }
        else { $env:PMIA_VALIDATE = $previousValidation }
    }
    if ($process.ExitCode -ne 0) {
        $details = ((Get-Content $stdout, $stderr -ErrorAction SilentlyContinue) -join [Environment]::NewLine)
        throw "$Label AutoHotkey validation failed ($($process.ExitCode)). $details"
    }
    $signal = (Get-Content $stdout -ErrorAction SilentlyContinue) -join ''
    if ($signal -notmatch 'AHK_VALID') {
        throw "$Label AutoHotkey validation did not emit AHK_VALID."
    }
    Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue
}

Push-Location $repo
try {
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "Node tests failed with exit code $LASTEXITCODE" }

    & npm run validate
    if ($LASTEXITCODE -ne 0) { throw "Extension validation failed with exit code $LASTEXITCODE" }

    Test-AutoHotkeyScript -Path $launcher -Label 'Main launcher'
    Test-AutoHotkeyScript -Path $reviewCompanion -Label 'Session review companion' -UseEnvironmentValidation

    $evidenceInputs = @($GateLog, $SmokeEvidence, $EvidenceManifest) | Where-Object { $_ }
    if ($evidenceInputs.Count -gt 0) {
        if ($evidenceInputs.Count -ne 3) { throw 'GateLog, SmokeEvidence, and EvidenceManifest must be provided together.' }
        & node $evidenceBuilder --repo $repo --gate-log $GateLog --smoke-evidence $SmokeEvidence --output $EvidenceManifest
        if ($LASTEXITCODE -ne 0) { throw "Release evidence manifest generation failed with exit code $LASTEXITCODE" }
    }

    Write-Host 'PMIA extension runtime validation passed.'
    Write-Host "Extension:        $extension"
    Write-Host "Launcher:         $launcher"
    Write-Host "Review companion: $reviewCompanion"
    Write-Host "Isolated smoke:   $isolatedSmoke"
}
finally {
    Pop-Location
}
