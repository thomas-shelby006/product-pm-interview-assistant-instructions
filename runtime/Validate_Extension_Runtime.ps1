param([string]$AutoHotkeyExe = '')

$ErrorActionPreference = 'Stop'

function Resolve-AutoHotkeyV2([string]$Requested = '') {
    if ($Requested) {
        if (-not (Test-Path -LiteralPath $Requested)) { throw "AutoHotkey v2 not found: $Requested" }
        return (Resolve-Path -LiteralPath $Requested).Path
    }
    $root = Join-Path $env:LOCALAPPDATA 'Programs\AutoHotkey'
    $direct = Join-Path $root 'v2\AutoHotkey64.exe'
    if (Test-Path -LiteralPath $direct) { return $direct }
    $versions = @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^v2\.\d+\.\d+$' } |
        Sort-Object { try { [version]$_.Name.Substring(1) } catch { [version]'0.0.0' } } -Descending)
    foreach ($directory in $versions) {
        $candidate = Join-Path $directory.FullName 'AutoHotkey64.exe'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    throw "AutoHotkey v2 not found under $root"
}

$repo = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $PSScriptRoot 'extension'
$launcher = Join-Path $PSScriptRoot 'Final_2_Window_Extension.ahk'
$transportSmoke = Join-Path $PSScriptRoot 'scripts\run-simple-isolated-smoke.mjs'
$providerSmoke = Join-Path $PSScriptRoot 'scripts\run-simple-provider-fixture-smoke.mjs'
if (-not (Test-Path (Join-Path $extension 'manifest.json'))) { throw 'Extension manifest missing.' }
if (-not (Test-Path $launcher)) { throw 'Optional PMIA Studio launcher missing.' }
if (-not (Test-Path $transportSmoke)) { throw 'Isolated transport smoke missing.' }
if (-not (Test-Path $providerSmoke)) { throw 'Provider fixture smoke missing.' }

$AutoHotkeyExe = Resolve-AutoHotkeyV2 $AutoHotkeyExe

function Test-AutoHotkeyBootstrap([string]$Path) {
    $stdout = Join-Path $env:TEMP 'pmia-012-ahk-out.txt'
    $stderr = Join-Path $env:TEMP 'pmia-012-ahk-err.txt'
    Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue
    $process = Start-Process $AutoHotkeyExe -ArgumentList @(
        '/ErrorStdOut=UTF-8', ('"' + $Path + '"'), '--validate'
    ) -RedirectStandardOutput $stdout -RedirectStandardError $stderr -Wait -PassThru
    $output = ((Get-Content $stdout, $stderr -ErrorAction SilentlyContinue) -join [Environment]::NewLine)
    if ($process.ExitCode -ne 0) { throw "AutoHotkey bootstrap validation failed. $output" }
    if ($output -match 'Warning:') { throw "AutoHotkey bootstrap emitted a warning. $output" }
    if ($output -notmatch 'AHK_VALID') { throw 'AutoHotkey bootstrap did not emit AHK_VALID.' }
    Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue
}

Push-Location $repo
try {
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "Active PMIA tests failed with exit code $LASTEXITCODE" }

    & npm run validate
    if ($LASTEXITCODE -ne 0) { throw "Active extension validation failed with exit code $LASTEXITCODE" }

    & node $transportSmoke
    if ($LASTEXITCODE -ne 0) { throw "Isolated transport smoke failed with exit code $LASTEXITCODE" }

    & node $providerSmoke
    if ($LASTEXITCODE -ne 0) { throw "Provider fixture smoke failed with exit code $LASTEXITCODE" }

    Test-AutoHotkeyBootstrap -Path $launcher

    Write-Host 'PMIA 0.12 active runtime validation passed.'
    Write-Host "Extension: $extension"
    Write-Host "Studio:    $(Join-Path $extension 'studio\index.html')"
    Write-Host "Cockpit:   $(Join-Path $extension 'cockpit\index.html')"
    Write-Host "Launcher:  $launcher"
}
finally {
    Pop-Location
}
