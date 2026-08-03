[CmdletBinding()]
param(
    [string]$DeploymentRoot = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PMIA Deployment'),
    [string]$SourceRoot = '',
    [string]$ProfileDirectory = 'Default',
    [string]$UserDataRoot = (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'),
    [string]$SettingsPath = (Join-Path $env:LOCALAPPDATA 'PMInterviewAssistant\settings.ini'),
    [string]$ReleaseEvidencePath = ''
)

$ErrorActionPreference = 'Stop'

function Read-PmiaIni {
    param([string]$Path)
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $values }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $value = [string]$line
        if (-not $value -or $value.TrimStart().StartsWith(';') -or $value.TrimStart().StartsWith('#')) { continue }
        $index = $value.IndexOf('=')
        if ($index -lt 1) { continue }
        $values[$value.Substring(0, $index).Trim()] = $value.Substring($index + 1).Trim()
    }
    return $values
}

function Invoke-PmiaPackageCheck {
    param([string]$Root, [string]$Kind, [string]$Verifier)
    try {
        $raw = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Verifier -PackageRoot $Root -ExpectedKind $Kind 2>&1
        if ($LASTEXITCODE -ne 0) { throw (($raw | Out-String).Trim()) }
        $json = ($raw | Out-String).Trim() | ConvertFrom-Json
        return [pscustomobject]@{ ok = $true; result = $json; error = '' }
    } catch {
        return [pscustomobject]@{ ok = $false; result = $null; error = [string]$_.Exception.Message }
    }
}

function ConvertFrom-PmiaProfileDoctor {
    param([string[]]$Lines)
    if (-not $Lines -or $Lines.Count -lt 2) { return @() }
    $columns = @($Lines[0] -split "`t")
    $rows = @()
    foreach ($line in @($Lines | Select-Object -Skip 1)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $values = @($line -split "`t", -1)
        $record = [ordered]@{}
        for ($index = 0; $index -lt $columns.Count; $index += 1) {
            $record[$columns[$index]] = if ($index -lt $values.Count) { $values[$index] } else { '' }
        }
        $record.pathMatches = [string]$record.pathMatches -eq 'True'
        $rows += [pscustomobject]$record
    }
    return $rows
}

$currentRoot = Join-Path $DeploymentRoot 'current'
$archiveRoot = Join-Path $DeploymentRoot 'archive\pmia-0.6.1-installed'
$verifier = Join-Path $currentRoot 'runtime\scripts\Test-PMIADeployment.ps1'
if (-not (Test-Path -LiteralPath $verifier -PathType Leaf)) {
    $verifier = Join-Path $PSScriptRoot 'Test-PMIADeployment.ps1'
}
$current = Invoke-PmiaPackageCheck -Root $currentRoot -Kind 'current' -Verifier $verifier
$archive = Invoke-PmiaPackageCheck -Root $archiveRoot -Kind 'installed-archive' -Verifier $verifier

$currentManifest = $null
if (Test-Path -LiteralPath (Join-Path $currentRoot 'deployment-manifest.json')) {
    try { $currentManifest = Get-Content -Raw -LiteralPath (Join-Path $currentRoot 'deployment-manifest.json') | ConvertFrom-Json } catch {}
}
if (-not $SourceRoot -and $currentManifest) { $SourceRoot = [string]$currentManifest.sourceRoot }

$releaseEvidence = $null
$releaseEvidenceError = ''
if ($ReleaseEvidencePath) {
    try {
        if (-not (Test-Path -LiteralPath $ReleaseEvidencePath -PathType Leaf)) { throw "Release evidence missing: $ReleaseEvidencePath" }
        $releaseEvidence = Get-Content -Raw -LiteralPath $ReleaseEvidencePath | ConvertFrom-Json
    } catch { $releaseEvidenceError = [string]$_.Exception.Message }
}

$settings = Read-PmiaIni -Path $SettingsPath
$edgeExecutable = [string]$settings['Executable']
if (-not $edgeExecutable) { $edgeExecutable = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$configuredUserDataRoot = [string]$settings['UserDataRoot']
if ($configuredUserDataRoot) { $UserDataRoot = $configuredUserDataRoot }
$configuredProfile = [string]$settings['ProfileDirectory']
if ($configuredProfile) { $ProfileDirectory = $configuredProfile }

$ahkCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\AutoHotkey\v2.0.24\AutoHotkey64.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\AutoHotkey\v2\AutoHotkey64.exe'),
    'C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe'
)
$ahkExecutable = [string](@($ahkCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1))

$extensionPath = Join-Path $currentRoot 'runtime\extension'
$doctorPath = Join-Path $currentRoot 'runtime\Browser_Profile_Doctor.ps1'
if (-not (Test-Path -LiteralPath $doctorPath -PathType Leaf)) { $doctorPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'Browser_Profile_Doctor.ps1' }
$profiles = @()
$doctorError = ''
try {
    $doctorOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $doctorPath -UserDataRoot $UserDataRoot -ExpectedExtensionPath $extensionPath -ProfileDirectory $ProfileDirectory -BrowserName 'Microsoft Edge Stable' 2>&1)
    if ($LASTEXITCODE -ne 0) { throw (($doctorOutput | Out-String).Trim()) }
    $profiles = @(ConvertFrom-PmiaProfileDoctor -Lines $doctorOutput)
} catch { $doctorError = [string]$_.Exception.Message }
$profile = @($profiles | Where-Object directory -eq $ProfileDirectory | Select-Object -First 1)
if ($profile.Count) { $profile = $profile[0] } else { $profile = $null }

$sourceClean = $false
$sourceCommit = ''
$sourceBranch = ''
if ($SourceRoot -and (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
    try {
        $sourceCommit = [string]((& git.exe -C $SourceRoot rev-parse HEAD 2>$null) | Select-Object -First 1)
        $sourceBranch = [string]((& git.exe -C $SourceRoot branch --show-current 2>$null) | Select-Object -First 1)
        $status = (& git.exe -C $SourceRoot status --porcelain 2>$null | Out-String).Trim()
        $sourceClean = $LASTEXITCODE -eq 0 -and -not $status
    } catch {}
}

$browserProfileOk = [bool]($profile -and [string]$profile.issueCode -eq 'OK')
$sourcePackage = [ordered]@{
    ok = [bool]($current.ok -and $archive.ok -and $sourceClean)
    currentPackage = [bool]$current.ok
    rollbackArchive = [bool]$archive.ok
    sourceClean = [bool]$sourceClean
}
$releaseCommit = if ($releaseEvidence) { [string]$releaseEvidence.commit } else { '' }
$expectedCommit = if ($current.result) { [string]$current.result.sourceCommit } else { $sourceCommit.Trim() }
$releaseCommitMatches = [bool]($releaseEvidence -and $releaseCommit -and $releaseCommit -eq $expectedCommit)
$deterministicBrowser = [ordered]@{
    ok = [bool]($releaseCommitMatches -and $releaseEvidence.smoke.deterministicBrowser.ok)
    checks = if ($releaseEvidence) { $releaseEvidence.smoke.deterministicBrowser.checks } else { $null }
    evidenceCommit = $releaseCommit
}
$providerCanary = [ordered]@{
    status = if ($releaseCommitMatches) { [string]$releaseEvidence.smoke.providerCanary.status } else { 'skipped' }
    reason = if ($releaseCommitMatches) { [string]$releaseEvidence.smoke.providerCanary.reason } else { if($releaseEvidenceError){'release_evidence_invalid'}else{'release_evidence_not_available'} }
    deliveryProofOk = [bool]($releaseCommitMatches -and $releaseEvidence.smoke.providerCanary.deliveryProofOk)
}
$normalProfileActivation = [ordered]@{
    ok = $browserProfileOk
    profileDirectory = $ProfileDirectory
    issueCode = if ($profile) { [string]$profile.issueCode } else { 'EDGE_PROFILE_NOT_FOUND' }
}
$packageReady = [bool]($sourcePackage.ok -and $deterministicBrowser.ok)
$activationReady = [bool]($packageReady -and $providerCanary.status -eq 'passed' -and $normalProfileActivation.ok)
$releaseStatus = if (-not $sourcePackage.ok) { 'source_package_failed' } elseif (-not $deterministicBrowser.ok) { 'deterministic_failed' } elseif ($activationReady) { 'ready' } elseif ($providerCanary.status -eq 'limited') { 'provider_limited' } elseif ($providerCanary.status -eq 'failed') { 'provider_failed' } elseif ($providerCanary.status -eq 'skipped') { 'provider_not_run' } else { 'activation_pending' }

$issues = @()
function Add-PmiaIssue { param([string]$Code, [string]$Message, [string]$Action) $script:issues += [pscustomobject]@{ code=$Code; message=$Message; action=$Action } }
if (-not $current.ok) { Add-PmiaIssue 'CURRENT_PACKAGE_INVALID' $current.error 'Rebuild and verify the current package before opening Edge.' }
if (-not $archive.ok) { Add-PmiaIssue 'ROLLBACK_ARCHIVE_INVALID' $archive.error 'Restore the immutable 0.6.1 archive before deployment.' }
if (-not (Test-Path -LiteralPath $edgeExecutable -PathType Leaf)) { Add-PmiaIssue 'EDGE_EXECUTABLE_MISSING' $edgeExecutable 'Install Microsoft Edge Stable or correct settings.ini.' }
if (-not $ahkExecutable) { Add-PmiaIssue 'AUTOHOTKEY_V2_MISSING' 'AutoHotkey v2 executable was not found.' 'Install AutoHotkey v2 before launching PMIA.' }
if (-not $sourceClean) { Add-PmiaIssue 'SOURCE_NOT_CLEAN' $SourceRoot 'Use a clean source commit before rebuilding current.' }
if ($releaseEvidenceError) { Add-PmiaIssue 'RELEASE_EVIDENCE_INVALID' $releaseEvidenceError 'Regenerate commit-bound release evidence.' }
elseif (-not $releaseEvidence) { Add-PmiaIssue 'RELEASE_EVIDENCE_NOT_PROVIDED' 'No release evidence was provided.' 'Run the final deterministic browser smoke and evidence builder.' }
elseif (-not $releaseCommitMatches) { Add-PmiaIssue 'RELEASE_EVIDENCE_COMMIT_MISMATCH' "$releaseCommit != $expectedCommit" 'Regenerate release evidence for the exact current package commit.' }
elseif (-not $deterministicBrowser.ok) { Add-PmiaIssue 'DETERMINISTIC_BROWSER_FAILED' 'Deterministic browser evidence did not pass.' 'Resolve the deterministic browser failure before deployment.' }
if ($providerCanary.status -eq 'limited') { Add-PmiaIssue 'PROVIDER_CANARY_LIMITED' $providerCanary.reason 'Run one real-provider acceptance flow in the normal Edge profile.' }
elseif ($providerCanary.status -eq 'failed') { Add-PmiaIssue 'PROVIDER_CANARY_FAILED' $providerCanary.reason 'Resolve the provider-rendering failure before activation.' }
elseif ($providerCanary.status -eq 'skipped') { Add-PmiaIssue 'PROVIDER_CANARY_NOT_RUN' $providerCanary.reason 'Run the provider canary or a normal-profile acceptance flow.' }
if ($doctorError) { Add-PmiaIssue 'PROFILE_DOCTOR_FAILED' $doctorError 'Run Browser_Profile_Doctor.ps1 manually and resolve the reported error.' }
elseif (-not $profile) { Add-PmiaIssue 'EDGE_PROFILE_NOT_FOUND' $ProfileDirectory 'Open the selected Edge profile once, then rerun readiness.' }
elseif ([string]$profile.issueCode -ne 'OK') { Add-PmiaIssue ([string]$profile.issueCode) ([string]$profile.issueMessage) $(switch ([string]$profile.issueCode) { 'EXTENSION_VERSION_MISMATCH' {'Open edge://extensions and select Reload on the PMIA card.'}; 'EXTENSION_PATH_MISMATCH' {'Load unpacked from the verified current runtime\extension directory.'}; default {'Load unpacked from the verified current runtime\extension directory.'} }) }

$versionMismatch = @($issues | Where-Object code -eq 'EXTENSION_VERSION_MISMATCH').Count -gt 0
$loadIssue = [bool]($profile -and @('EXTENSION_PATH_MISMATCH','EXTENSION_NOT_REGISTERED') -contains [string]$profile.issueCode)
$operatorPrerequisitesReady = [bool]((Test-Path -LiteralPath $edgeExecutable -PathType Leaf) -and $ahkExecutable -and -not $doctorError)
$result = [ordered]@{
    schema = 'pmia-deployment-readiness/v2'
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    deploymentRoot = [IO.Path]::GetFullPath($DeploymentRoot)
    source = [ordered]@{ root=$SourceRoot; branch=$sourceBranch.Trim(); commit=$sourceCommit.Trim(); clean=$sourceClean }
    current = [ordered]@{ ok=$current.ok; root=$currentRoot; version=if($current.result){[string]$current.result.version}else{''}; sourceCommit=if($current.result){[string]$current.result.sourceCommit}else{''}; checksumCount=if($current.result){[int]$current.result.checksumCount}else{0}; error=$current.error }
    archive = [ordered]@{ ok=$archive.ok; root=$archiveRoot; version=if($archive.result){[string]$archive.result.version}else{''}; sourceCommit=if($archive.result){[string]$archive.result.sourceCommit}else{''}; checksumCount=if($archive.result){[int]$archive.result.checksumCount}else{0}; error=$archive.error }
    prerequisites = [ordered]@{ edgeExecutable=$edgeExecutable; edgeAvailable=(Test-Path -LiteralPath $edgeExecutable -PathType Leaf); autoHotkeyV2=$ahkExecutable; autoHotkeyAvailable=[bool]$ahkExecutable; powershellAvailable=$true; nodeAvailable=[bool](Get-Command node.exe -ErrorAction SilentlyContinue) }
    browser = [ordered]@{ userDataRoot=$UserDataRoot; profileDirectory=$ProfileDirectory; expectedExtensionPath=$extensionPath; observed=$profile; doctorError=$doctorError }
    issues = $issues
    releaseVerification = [ordered]@{
        status = $releaseStatus
        sourcePackage = $sourcePackage
        deterministicBrowser = $deterministicBrowser
        providerCanary = $providerCanary
        normalProfileActivation = $normalProfileActivation
        packageReady = $packageReady
        activationReady = $activationReady
    }
    packagesReady = [bool]($current.ok -and $archive.ok)
    packageReady = $packageReady
    activationReady = $activationReady
    readyForManualEdgeReload = [bool]($packageReady -and $operatorPrerequisitesReady -and $versionMismatch)
    readyForManualEdgeLoad = [bool]($packageReady -and $operatorPrerequisitesReady -and $loadIssue)
    ready = $activationReady
}
$result | ConvertTo-Json -Depth 8
