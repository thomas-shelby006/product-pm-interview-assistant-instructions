[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][string]$DeploymentRoot
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'PMIA-Deployment.Common.ps1')

$source = Resolve-PmiaCanonicalPath $SourceRoot
# Fail closed unless the source is equivalent to a clean `git status --porcelain`.
Assert-PmiaGitClean -SourceRoot $source
$sourceCommit = Get-PmiaGitCommit -SourceRoot $source
if (-not $sourceCommit) { throw 'Current deployment requires an exact Git source commit.' }

$extensionManifestPath = Join-Path $source 'runtime\extension\manifest.json'
if (-not (Test-Path -LiteralPath $extensionManifestPath -PathType Leaf)) {
    throw 'Source extension manifest is missing.'
}
$extensionManifest = Get-Content -Raw -LiteralPath $extensionManifestPath | ConvertFrom-Json
$version = [string]$extensionManifest.version
if ([string]::IsNullOrWhiteSpace($version)) { throw 'Source extension version is missing.' }

New-Item -ItemType Directory -Force $DeploymentRoot | Out-Null
$deployment = [IO.Path]::GetFullPath($DeploymentRoot).TrimEnd('\')
$token = [guid]::NewGuid().ToString('N')
$staging = Join-Path $deployment ".current-staging-$token"
$current = Join-Path $deployment 'current'
$backup = Join-Path $deployment ".current-previous-$token"
$verifyScript = Join-Path $PSScriptRoot 'Test-PMIADeployment.ps1'

try {
    New-Item -ItemType Directory -Force $staging | Out-Null
    Copy-PmiaAllowlistedSource -SourceRoot $source -DestinationRoot $staging
    $stats = Get-PmiaPackageStats -PackageRoot $staging
    $manifest = [ordered]@{
        schemaVersion = 1
        kind = 'current'
        product = [string]$extensionManifest.name
        version = $version
        sourceCommit = $sourceCommit
        sourceRoot = $source
        generatedAt = [DateTime]::UtcNow.ToString('o')
        fileCount = $stats.fileCount
        totalBytes = $stats.totalBytes
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
    & $verifyScript -PackageRoot $staging -ExpectedKind 'current' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Staged current deployment verification failed.' }

    if (Test-Path -LiteralPath $current) { Move-Item -LiteralPath $current -Destination $backup }
    Move-Item -LiteralPath $staging -Destination $current
    & $verifyScript -PackageRoot $current -ExpectedKind 'current' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Promoted current deployment verification failed.' }
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
} catch {
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    if ((Test-Path -LiteralPath $backup) -and -not (Test-Path -LiteralPath $current)) {
        Move-Item -LiteralPath $backup -Destination $current
    }
    throw
}

& $verifyScript -PackageRoot $current -ExpectedKind 'current'
