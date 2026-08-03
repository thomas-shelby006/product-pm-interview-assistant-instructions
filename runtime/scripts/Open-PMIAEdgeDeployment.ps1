[CmdletBinding()]
param(
    [string]$DeploymentRoot = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PMIA Deployment'),
    [string]$ProfileDirectory = 'Default',
    [switch]$OpenEdge
)

$ErrorActionPreference = 'Stop'
$readinessScript = Join-Path $PSScriptRoot 'Get-PMIADeploymentReadiness.ps1'
$raw = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $readinessScript -DeploymentRoot $DeploymentRoot -ProfileDirectory $ProfileDirectory 2>&1
if ($LASTEXITCODE -ne 0) { throw (($raw | Out-String).Trim()) }
$readiness = ($raw | Out-String).Trim() | ConvertFrom-Json
if (-not $readiness.packagesReady) { throw 'PMIA current or rollback package failed integrity verification.' }
if (-not $readiness.prerequisites.edgeAvailable) { throw 'Microsoft Edge Stable executable is unavailable.' }
if (-not $readiness.prerequisites.autoHotkeyAvailable) { throw 'AutoHotkey v2 executable is unavailable.' }

$extensionPath = [string]$readiness.browser.expectedExtensionPath
if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) { Set-Clipboard -Value $extensionPath }
$action = 'reload'
if ($readiness.browser.observed -eq $null -or [string]$readiness.browser.observed.issueCode -in @('EXTENSION_NOT_REGISTERED','EXTENSION_PATH_MISMATCH')) { $action = 'load_unpacked' }
if ($OpenEdge) { Start-Process -FilePath ([string]$readiness.prerequisites.edgeExecutable) -ArgumentList 'edge://extensions' }

$steps = if ($action -eq 'reload') {
    @(
        'Open edge://extensions in the selected profile.',
        'Enable Developer mode.',
        'Find PM Interview Dual-Provider Runtime and select Reload.',
        'Reload already-open managed provider tabs or start a fresh PMIA session.',
        'Run Profile Doctor and require issueCode OK.'
    )
} else {
    @(
        'Open edge://extensions in the selected profile.',
        'Enable Developer mode.',
        'Select Load unpacked.',
        "Choose exactly: $extensionPath",
        'Confirm the expected version, then run Profile Doctor and Preflight.'
    )
}

$result = [ordered]@{
    schema = 'pmia-edge-deployment-action/v1'
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    openedEdge = [bool]$OpenEdge
    profileDirectory = [string]$readiness.browser.profileDirectory
    extensionPath = $extensionPath
    extensionPathCopied = [bool](Get-Command Set-Clipboard -ErrorAction SilentlyContinue)
    expectedVersion = [string]$readiness.current.version
    action = $action
    steps = $steps
    readiness = $readiness
}
$result | ConvertTo-Json -Depth 10
