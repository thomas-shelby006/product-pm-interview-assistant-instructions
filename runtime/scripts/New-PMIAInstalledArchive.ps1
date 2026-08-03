[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$InstalledExtensionPath,
    [Parameter(Mandatory = $true)][string]$DeploymentRoot,
    [Parameter(Mandatory = $true)][string]$RegisteredPath,
    [Parameter(Mandatory = $true)][string]$ProfileDirectory,
    [Parameter(Mandatory = $true)][string]$ExtensionId,
    [string]$ExpectedVersion = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'PMIA-Deployment.Common.ps1')

$resolvedExtension = Resolve-PmiaCanonicalPath $InstalledExtensionPath
$manifestPath = Join-Path $resolvedExtension 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'Installed extension manifest is missing.'
}
$extensionManifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$version = [string]$extensionManifest.version
if ([string]::IsNullOrWhiteSpace($version)) { throw 'Installed extension version is missing.' }
if ($ExpectedVersion -and $version -ne $ExpectedVersion) {
    throw "Installed extension version $version does not match expected $ExpectedVersion."
}

$runtimeRoot = Split-Path -Parent $resolvedExtension
$sourceRoot = Split-Path -Parent $runtimeRoot
$sourceCommit = Get-PmiaGitCommit -SourceRoot $sourceRoot
$registeredFull = [IO.Path]::GetFullPath($RegisteredPath).TrimEnd('\')
New-Item -ItemType Directory -Force $DeploymentRoot | Out-Null
$deployment = [IO.Path]::GetFullPath($DeploymentRoot).TrimEnd('\')
$archiveParent = Join-Path $deployment 'archive'
$archiveRoot = Join-Path $archiveParent "pmia-$version-installed"
if (Test-Path -LiteralPath $archiveRoot) {
    throw "Installed archive already exists and will not be overwritten: $archiveRoot"
}
$token = [guid]::NewGuid().ToString('N')
$staging = Join-Path $deployment ".archive-staging-$token"
$verifyScript = Join-Path $PSScriptRoot 'Test-PMIADeployment.ps1'

try {
    New-Item -ItemType Directory -Force $staging | Out-Null
    Copy-PmiaAllowlistedSource -SourceRoot $sourceRoot -DestinationRoot $staging
    $stats = Get-PmiaPackageStats -PackageRoot $staging
    $manifest = [ordered]@{
        schemaVersion = 1
        kind = 'installed-archive'
        product = [string]$extensionManifest.name
        version = $version
        sourceCommit = $sourceCommit
        sourceRoot = $sourceRoot
        generatedAt = [DateTime]::UtcNow.ToString('o')
        fileCount = $stats.fileCount
        totalBytes = $stats.totalBytes
        profileDirectory = $ProfileDirectory
        extensionId = $ExtensionId
        registeredPath = $registeredFull
        resolvedExtensionPath = $resolvedExtension
        extensionPath = 'runtime\extension'
        launcherPath = 'runtime\Final_2_Window_Extension.ahk'
    }
    $manifestJson = $manifest | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText(
        (Join-Path $staging 'deployment-manifest.json'),
        $manifestJson + [Environment]::NewLine,
        (New-Object Text.UTF8Encoding($false))
    )
    Write-PmiaChecksums -PackageRoot $staging | Out-Null
    & $verifyScript -PackageRoot $staging -ExpectedKind 'installed-archive' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Installed archive staging verification failed.' }
    New-Item -ItemType Directory -Force $archiveParent | Out-Null
    Move-Item -LiteralPath $staging -Destination $archiveRoot
    & $verifyScript -PackageRoot $archiveRoot -ExpectedKind 'installed-archive' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Installed archive final verification failed.' }
} catch {
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    throw
}

& $verifyScript -PackageRoot $archiveRoot -ExpectedKind 'installed-archive'
