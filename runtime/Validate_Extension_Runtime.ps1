param(
    [string]$AutoHotkeyExe = "$env:LOCALAPPDATA\Programs\AutoHotkey\v2\AutoHotkey64.exe"
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $PSScriptRoot 'extension'
$launcher = Join-Path $PSScriptRoot 'Final_2_Window_Extension.ahk'

if (-not (Test-Path $AutoHotkeyExe)) { throw "AutoHotkey v2 not found: $AutoHotkeyExe" }
if (-not (Test-Path (Join-Path $extension 'manifest.json'))) { throw 'Extension manifest missing.' }
if (-not (Test-Path $launcher)) { throw 'Extension launcher missing.' }

Push-Location $repo
try {
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "Node tests failed with exit code $LASTEXITCODE" }

    & npm run validate
    if ($LASTEXITCODE -ne 0) { throw "Extension validation failed with exit code $LASTEXITCODE" }

    $stdout = Join-Path $env:TEMP 'pmia-ahk-validation-out.txt'
    $stderr = Join-Path $env:TEMP 'pmia-ahk-validation-err.txt'
    Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue
    $process = Start-Process $AutoHotkeyExe `
        -ArgumentList @('/ErrorStdOut', ('"' + $launcher + '"'), '--validate') `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        $details = ((Get-Content $stdout, $stderr -ErrorAction SilentlyContinue) -join [Environment]::NewLine)
        throw "AutoHotkey validation failed ($($process.ExitCode)). $details"
    }
    $signal = (Get-Content $stdout -ErrorAction SilentlyContinue) -join ''
    if ($signal -notmatch 'AHK_VALID') { throw 'AutoHotkey validation did not emit AHK_VALID.' }

    Write-Host 'PMIA extension runtime validation passed.'
    Write-Host "Extension: $extension"
    Write-Host "Launcher:  $launcher"
}
finally {
    Pop-Location
}
