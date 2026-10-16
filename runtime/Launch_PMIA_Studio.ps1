[CmdletBinding()]
param(
    [string]$ExtensionDir = '',
    [string]$ProfileDir = '',
    [string]$BrowserExe = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    [string]$ExtensionId = '',
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$defaultSource = Join-Path $PSScriptRoot 'extension'
$defaultDeploy = Join-Path $repo 'runtime\extension\__pmia012_deploy'
try {
    $common = (& git -C $repo rev-parse --path-format=absolute --git-common-dir 2>$null).Trim()
    if ($LASTEXITCODE -eq 0 -and $common) {
        $mainDeploy = Join-Path (Split-Path $common -Parent) 'runtime\extension\__pmia012_deploy'
        if (Test-Path -LiteralPath $mainDeploy) { $defaultDeploy = $mainDeploy }
    }
} catch {}
if (-not $ExtensionDir) {
    $ExtensionDir = if (Test-Path -LiteralPath $defaultDeploy) { $defaultDeploy } else { $defaultSource }
}
$ExtensionDir = (Resolve-Path -LiteralPath $ExtensionDir).Path
$manifestPath = Join-Path $ExtensionDir 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw "PMIA extension manifest not found: $manifestPath" }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.version -ne '0.12.1' -or $manifest.background.service_worker -ne 'simple/service-worker.js') {
    throw "Expected verified PMIA 0.12.1, found $($manifest.version) at $ExtensionDir"
}
if (-not $ProfileDir) { $ProfileDir = Join-Path $env:LOCALAPPDATA 'PMInterviewAssistant\EdgeProfile' }
$ProfileDir = [IO.Path]::GetFullPath($ProfileDir)
$normalEdge = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'
if ($ProfileDir.TrimEnd('\').Equals($normalEdge.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to inject extensions into the regular Edge profile. Choose a dedicated PMIA directory.'
}
if (-not $ExtensionId) {
    # Verified IDs are specific to these exact unpacked paths on this Windows machine.
    $ExtensionId = if ($ExtensionDir.Equals($defaultDeploy,[StringComparison]::OrdinalIgnoreCase)) {
        'ldhkaojbodiibhhdllkiffbcfhofiimk'
    } elseif ($ExtensionDir.Equals($defaultSource,[StringComparison]::OrdinalIgnoreCase)) {
        'iipjabmpkjahmnoinhmidlbekaifjokg'
    } else {
        throw 'Unrecognized extension path: supply -ExtensionId obtained from the Edge isolated smoke.'
    }
}
if ($ExtensionId -notmatch '^[a-p]{32}$') { throw 'Extension ID must contain 32 letters from a to p.' }
if ($ValidateOnly) {
    Write-Output "PMIA_LAUNCH_VALID version=$($manifest.version) extension=$ExtensionDir id=$ExtensionId profile=$ProfileDir"
    exit 0
}
if (-not (Test-Path -LiteralPath $BrowserExe)) { throw "Microsoft Edge not found: $BrowserExe" }
New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
$studio = "chrome-extension://$ExtensionId/studio/index.html"
$baseArgs = @(
    ('--user-data-dir="' + $ProfileDir + '"'),
    ('--disable-extensions-except="' + $ExtensionDir + '"'),
    ('--load-extension="' + $ExtensionDir + '"'),
    '--no-first-run'
)
$primary = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'msedge.exe' -and $_.CommandLine -like ('*' + $ProfileDir + '*') -and $_.CommandLine -notlike '*--type=*'
})
if (-not $primary.Count) {
    # Chromium may navigate before a command-line-loaded extension is registered.
    # Start the browser first, then wait for its PMIA toolbar action to appear.
    $process = Start-Process -FilePath $BrowserExe -ArgumentList ($baseArgs + @('--new-window','about:blank')) -PassThru
    $ready = $false
    try {
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        $deadline = (Get-Date).AddSeconds(15)
        while ((Get-Date) -lt $deadline -and -not $ready) {
            Start-Sleep -Milliseconds 250
            $live = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
            if (-not $live -or $live.MainWindowHandle -eq 0) { continue }
            $element = [System.Windows.Automation.AutomationElement]::FromHandle($live.MainWindowHandle)
            $buttons = $element.FindAll([System.Windows.Automation.TreeScope]::Descendants,
                ([System.Windows.Automation.PropertyCondition]::new(
                    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                    [System.Windows.Automation.ControlType]::Button)))
            foreach ($button in $buttons) {
                if ($button.Current.Name -like 'Open PMIA Studio*') { $ready = $true; break }
            }
        }
    } catch {
        Write-Warning ('Could not verify toolbar readiness: ' + $_.Exception.Message)
    }
    if (-not $ready) {
        throw "PMIA toolbar action did not appear in Edge. Check edge://extensions in the dedicated profile."
    }
}
$opened = Start-Process -FilePath $BrowserExe -ArgumentList ($baseArgs + @('--new-window', $studio)) -PassThru
Write-Output "PMIA_STUDIO_STARTED pid=$($opened.Id) extension=$ExtensionDir profile=$ProfileDir"
