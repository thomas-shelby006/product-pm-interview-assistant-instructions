[CmdletBinding()]
param(
    [string]$DeploymentRoot = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PMIA Deployment'),
    [string]$SourceRoot = '',
    [string]$ProfileDirectory = 'Default',
    [string]$EvidenceDirectory = '',
    [string]$GuideFile = '',
    [string]$OutputPath = '',
    [switch]$RetainEvidencePath
)

$ErrorActionPreference = 'Stop'
$readinessScript = Join-Path $PSScriptRoot 'Get-PMIADeploymentReadiness.ps1'
$releaseEvidencePath = if ($EvidenceDirectory) { Join-Path $EvidenceDirectory 'release-evidence-manifest.json' } else { '' }
$raw = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $readinessScript -DeploymentRoot $DeploymentRoot -SourceRoot $SourceRoot -ProfileDirectory $ProfileDirectory -ReleaseEvidencePath $releaseEvidencePath 2>&1
if ($LASTEXITCODE -ne 0) { throw (($raw | Out-String).Trim()) }
$readiness = ($raw | Out-String).Trim() | ConvertFrom-Json
if (-not $SourceRoot) { $SourceRoot = [string]$readiness.source.root }
if (-not $OutputPath) { $OutputPath = Join-Path $DeploymentRoot 'DEPLOYMENT_INVENTORY.json' }
if (-not $GuideFile) { $GuideFile = Join-Path $DeploymentRoot ("PMIA_{0}_DEPLOYMENT_AND_TECHNICAL_GUIDE.html" -f [string]$readiness.current.version) }

function Read-PmiaJsonIfPresent {
    param([string]$Directory, [string]$FileName)
    if (-not $Directory) { return $null }
    $path = Join-Path $Directory $FileName
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
    return Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
}

$release = Read-PmiaJsonIfPresent $EvidenceDirectory 'release-evidence-manifest.json'
$handoff = Read-PmiaJsonIfPresent $EvidenceDirectory 'handoff-manifest.json'
$worktreeEvidence = Read-PmiaJsonIfPresent $EvidenceDirectory 'worktree-integration-manifest.json'
$equivalence = Read-PmiaJsonIfPresent $EvidenceDirectory 'production-object-equivalence.json'
$currentManifest = Get-Content -Raw -LiteralPath (Join-Path ([string]$readiness.current.root) 'deployment-manifest.json') | ConvertFrom-Json
$archiveManifest = Get-Content -Raw -LiteralPath (Join-Path ([string]$readiness.archive.root) 'deployment-manifest.json') | ConvertFrom-Json

$branches = @()
$worktrees = @()
$tags = @()
if ($SourceRoot -and (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
    $branches = @(& git.exe -C $SourceRoot branch --format='%(refname:short)' 2>$null | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
    $worktrees = @(& git.exe -C $SourceRoot worktree list 2>$null | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
    $tags = @(& git.exe -C $SourceRoot tag --points-at HEAD 2>$null | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
}
$entries = @(Get-ChildItem -LiteralPath $DeploymentRoot -Force | Select-Object -ExpandProperty Name | Sort-Object)

$inventory = [ordered]@{
    schema = 'pmia-deployment-inventory/v3'
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    deploymentRoot = [IO.Path]::GetFullPath($DeploymentRoot)
    archive = [ordered]@{
        path = [string]$readiness.archive.root
        version = [string]$readiness.archive.version
        sourceCommit = [string]$readiness.archive.sourceCommit
        manifestFileCount = [int]$archiveManifest.fileCount
        checksumCount = [int]$readiness.archive.checksumCount
        verified = [bool]$readiness.archive.ok
        profileDirectory = [string]$archiveManifest.profileDirectory
        extensionId = [string]$archiveManifest.extensionId
        registeredPath = [string]$archiveManifest.registeredPath
        resolvedExtensionPath = [string]$archiveManifest.resolvedExtensionPath
    }
    current = [ordered]@{
        path = [string]$readiness.current.root
        version = [string]$readiness.current.version
        sourceCommit = [string]$readiness.current.sourceCommit
        manifestFileCount = [int]$currentManifest.fileCount
        checksumCount = [int]$readiness.current.checksumCount
        verified = [bool]$readiness.current.ok
        extensionPath = [string]$readiness.browser.expectedExtensionPath
        launcherPath = Join-Path ([string]$readiness.current.root) 'runtime\Final_2_Window_Extension.ahk'
    }
    source = [ordered]@{
        path = [string]$readiness.source.root
        branch = [string]$readiness.source.branch
        commit = [string]$readiness.source.commit
        clean = [bool]$readiness.source.clean
        localBranches = $branches
        worktrees = $worktrees
        tagsAtHead = $tags
    }
    browser = [ordered]@{
        profileDirectory = [string]$readiness.browser.profileDirectory
        expectedCurrentPath = [string]$readiness.browser.expectedExtensionPath
        observed = $readiness.browser.observed
        browserExecutable = [string]$readiness.prerequisites.edgeExecutable
        manualEdgeReloadRequired = [bool]$readiness.readyForManualEdgeReload
        manualEdgeLoadRequired = [bool]$readiness.readyForManualEdgeLoad
    }
    evidence = [ordered]@{
        path = if ($RetainEvidencePath) { $EvidenceDirectory } else { '' }
        rawEvidenceRetained = [bool]$RetainEvidencePath
        releaseManifestHash = if ($release) { [string]$release.manifestHash } else { '' }
        handoffHash = if ($handoff) { [string]$handoff.handoffHash } else { '' }
        worktreeManifestHash = if ($worktreeEvidence) { [string]$worktreeEvidence.manifestHash } else { '' }
        equivalenceHash = if ($equivalence) { [string]$equivalence.equivalenceHash } else { '' }
        finalGate = if ($release) { $release.gate } else { $null }
        releaseVerification = $readiness.releaseVerification
        productionObjectCount = if ($equivalence) { [int]$equivalence.productionObjectCount } elseif ($release) { @($release.sourceHashes.PSObject.Properties).Count } else { 0 }
    }
    prerequisites = $readiness.prerequisites
    readiness = [ordered]@{
        packagesReady = [bool]$readiness.packagesReady
        packageReady = [bool]$readiness.packageReady
        activationReady = [bool]$readiness.activationReady
        sourceReady = [bool]$readiness.source.clean
        browserReady = [bool]$readiness.releaseVerification.normalProfileActivation.ok
        releaseVerification = $readiness.releaseVerification
        readyForManualEdgeReload = [bool]$readiness.readyForManualEdgeReload
        readyForManualEdgeLoad = [bool]$readiness.readyForManualEdgeLoad
        issues = $readiness.issues
        cloudDeploymentPerformed = $false
        pushed = $false
        tagged = $false
    }
    instructions = [ordered]@{
        markdown = Join-Path ([string]$readiness.current.root) 'DEPLOYMENT_GUIDE.md'
        html = $GuideFile
    }
    cleanup = [ordered]@{
        remainingDeploymentEntries = $entries
        onlyMainBranch = [bool]($branches.Count -eq 1 -and $branches[0] -eq 'main')
        onlyMainWorktree = [bool]($worktrees.Count -eq 1)
    }
}
$parent = Split-Path -Parent $OutputPath
if ($parent) { New-Item -ItemType Directory -Force $parent | Out-Null }
[IO.File]::WriteAllText($OutputPath, ($inventory | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
$inventory | ConvertTo-Json -Depth 12
