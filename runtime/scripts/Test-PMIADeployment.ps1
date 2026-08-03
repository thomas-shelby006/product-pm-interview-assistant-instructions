[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PackageRoot,
    [ValidateSet('', 'current', 'installed-archive')][string]$ExpectedKind = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'PMIA-Deployment.Common.ps1')

function Assert-PmiaRequiredFile {
    param([string]$Root, [string]$RelativePath)
    $path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required deployment file missing: $RelativePath"
    }
}

$root = Resolve-PmiaCanonicalPath $PackageRoot
Assert-PmiaNoReparsePoints -Root $root
foreach ($required in @(
    'deployment-manifest.json',
    'checksums.sha256',
    'runtime\extension\manifest.json',
    'runtime\Final_2_Window_Extension.ahk',
    'runtime\Session_Tracker_End_Session.ahk',
    'runtime\Browser_Profile_Doctor.ps1',
    'runtime\Validate_Extension_Runtime.ps1'
)) { Assert-PmiaRequiredFile -Root $root -RelativePath $required }

$deploymentManifest = Get-Content -Raw -LiteralPath (Join-Path $root 'deployment-manifest.json') |
    ConvertFrom-Json
$extensionManifest = Get-Content -Raw -LiteralPath (Join-Path $root 'runtime\extension\manifest.json') |
    ConvertFrom-Json

if ([int]$deploymentManifest.schemaVersion -ne 1) {
    throw "Unsupported deployment manifest schema: $($deploymentManifest.schemaVersion)"
}
if ([string]$deploymentManifest.kind -notin @('current', 'installed-archive')) {
    throw "Unsupported deployment kind: $($deploymentManifest.kind)"
}
if ($ExpectedKind -and [string]$deploymentManifest.kind -ne $ExpectedKind) {
    throw "Deployment kind mismatch: $($deploymentManifest.kind), expected $ExpectedKind"
}
if ([string]$deploymentManifest.product -ne [string]$extensionManifest.name) {
    throw 'Deployment product does not match extension manifest.'
}
if ([string]$deploymentManifest.version -ne [string]$extensionManifest.version) {
    throw 'Deployment version does not match extension manifest.'
}
$extensionPath = ([string]$deploymentManifest.extensionPath).Replace('/', '\')
if (-not $extensionPath.Equals('runtime\extension', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Deployment extension path is not the supported runtime path.'
}
$launcherPath = ([string]$deploymentManifest.launcherPath).Replace('/', '\')
if (-not $launcherPath.Equals('runtime\Final_2_Window_Extension.ahk', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Deployment launcher path is not the supported runtime launcher.'
}

$sourceCommit = [string]$deploymentManifest.sourceCommit
if ($sourceCommit -notmatch '^(?:[A-Fa-f0-9]{40}|[A-Fa-f0-9]{64})$') {
    throw 'Deployment source commit is missing or invalid.'
}
$sourceRoot = [string]$deploymentManifest.sourceRoot
if ([string]::IsNullOrWhiteSpace($sourceRoot) -or -not [IO.Path]::IsPathRooted($sourceRoot)) {
    throw 'Deployment source root is missing or invalid.'
}
$generatedAt = [DateTimeOffset]::MinValue
if (-not [DateTimeOffset]::TryParse([string]$deploymentManifest.generatedAt, [ref]$generatedAt)) {
    throw 'Deployment generation timestamp is missing or invalid.'
}

if ([string]$deploymentManifest.kind -eq 'current') {
    Assert-PmiaRequiredFile -Root $root -RelativePath 'DEPLOYMENT_GUIDE.md'
    Assert-PmiaRequiredFile -Root $root -RelativePath 'package.json'
}
if ([string]$deploymentManifest.kind -eq 'installed-archive') {
    foreach ($field in @(
        'profileDirectory',
        'extensionId',
        'registeredPath',
        'resolvedExtensionPath'
    )) {
        if ([string]::IsNullOrWhiteSpace([string]$deploymentManifest.$field)) {
            throw "Installed archive identity is missing: $field"
        }
    }
}

$packageStats = Get-PmiaPackageStats -PackageRoot $root
if ([int64]$deploymentManifest.fileCount -ne [int64]$packageStats.fileCount) {
    throw "Deployment payload file count mismatch: $($deploymentManifest.fileCount), actual $($packageStats.fileCount)"
}
if ([int64]$deploymentManifest.totalBytes -ne [int64]$packageStats.totalBytes) {
    throw "Deployment payload byte count mismatch: $($deploymentManifest.totalBytes), actual $($packageStats.totalBytes)"
}

$allFiles = @(Get-ChildItem -LiteralPath $root -Recurse -File -Force)
foreach ($file in $allFiles) {
    $relative = Get-PmiaRelativePath -Root $root -Path $file.FullName
    if (Test-PmiaForbiddenRelativePath $relative) {
        throw "Forbidden deployment path found: $relative"
    }
}

$checksumPath = Join-Path $root 'checksums.sha256'
$expected = @{}
foreach ($line in Get-Content -LiteralPath $checksumPath) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line -notmatch '^([A-Fa-f0-9]{64})  (.+)$') {
        throw "Invalid checksum line: $line"
    }
    $relative = $matches[2].Replace('/', '\')
    $key = $relative.ToLowerInvariant()
    if ($expected.ContainsKey($key)) {
        throw "Duplicate checksum entry: $relative"
    }
    $expected[$key] = $matches[1].ToUpperInvariant()
}

$actualFiles = @($allFiles | Where-Object Name -ne 'checksums.sha256')
foreach ($file in $actualFiles) {
    $relative = Get-PmiaRelativePath -Root $root -Path $file.FullName
    $key = $relative.ToLowerInvariant()
    if (-not $expected.ContainsKey($key)) {
        throw "File is missing from checksum inventory: $relative"
    }
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToUpperInvariant()
    if ($actualHash -ne $expected[$key]) {
        throw "Checksum mismatch: $relative"
    }
}
if ($expected.Count -ne $actualFiles.Count) {
    throw "Checksum inventory count mismatch: $($expected.Count) entries, $($actualFiles.Count) files"
}

$result = [ordered]@{
    ok = $true
    packageRoot = $root
    kind = [string]$deploymentManifest.kind
    version = [string]$deploymentManifest.version
    sourceCommit = $sourceCommit
    fileCount = $actualFiles.Count
    checksumCount = $expected.Count
}
$result | ConvertTo-Json -Depth 4
