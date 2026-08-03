Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:PmiaForbiddenSegments = @(
    '.git', '.worktrees', '.pmia-task-temp', 'evidence', 'logs',
    'temporary-edge-profile', 'node_modules', '__pycache__'
)
$script:PmiaForbiddenFiles = @('settings.ini', 'secure preferences', 'preferences')
$script:PmiaRootDirectories = @('runtime', 'project_upload_bundle', 'review_lab_project', 'templates')
$script:PmiaRootFiles = @(
    'README.md', 'AI_SYSTEM_CONTEXT.md', 'FILE_MAP.md',
    'CUSTOM_INSTRUCTIONS_TO_PASTE_IN_CHATGPT_PROJECT.md',
    'DEPLOYMENT_GUIDE.md', 'package.json'
)

function Resolve-PmiaCanonicalPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.LinkType -and $item.Target) {
        $target = @($item.Target)[0]
        if (-not [IO.Path]::IsPathRooted($target)) {
            $target = Join-Path $item.Parent.FullName $target
        }
        return [IO.Path]::GetFullPath($target).TrimEnd('\')
    }
    return [IO.Path]::GetFullPath($item.FullName).TrimEnd('\')
}

function Test-PmiaPathWithin {
    param([string]$Parent, [string]$Candidate)
    $parentFull = [IO.Path]::GetFullPath($Parent).TrimEnd('\')
    $candidateFull = [IO.Path]::GetFullPath($Candidate).TrimEnd('\')
    if ($candidateFull.Equals($parentFull, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    return $candidateFull.StartsWith($parentFull + '\', [StringComparison]::OrdinalIgnoreCase)
}

function Assert-PmiaPathsSeparate {
    param([string]$SourceRoot, [string]$DeploymentRoot)
    if ((Test-PmiaPathWithin -Parent $SourceRoot -Candidate $DeploymentRoot) -or
        (Test-PmiaPathWithin -Parent $DeploymentRoot -Candidate $SourceRoot)) {
        throw "Source and deployment roots must not overlap: $SourceRoot ; $DeploymentRoot"
    }
}

function Assert-PmiaNoReparsePoints {
    param([string]$Root)
    if (-not (Test-Path -LiteralPath $Root)) { return }
    $items = @((Get-Item -LiteralPath $Root -Force)) + @(Get-ChildItem -LiteralPath $Root -Recurse -Force)
    foreach ($item in $items) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Reparse point is not allowed in a PMIA package boundary: $($item.FullName)"
        }
    }
}

function Get-PmiaRelativePath {
    param([string]$Root, [string]$Path)
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    $pathFull = [IO.Path]::GetFullPath($Path)
    return $pathFull.Substring($rootFull.Length).TrimStart('\')
}

function Test-PmiaForbiddenRelativePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $segments = @(($RelativePath -replace '/', '\').Split('\') |
        Where-Object { $_ -ne '' } |
        ForEach-Object { $_.ToLowerInvariant() })
    foreach ($segment in $segments) {
        if ($script:PmiaForbiddenSegments -contains $segment) { return $true }
    }
    if ($segments.Count -and $script:PmiaForbiddenFiles -contains $segments[-1]) { return $true }
    return $false
}

function Copy-PmiaDirectoryFiltered {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) { return }
    Assert-PmiaNoReparsePoints -Root $Source
    $sourceFull = [IO.Path]::GetFullPath($Source).TrimEnd('\')
    foreach ($file in Get-ChildItem -LiteralPath $sourceFull -Recurse -File -Force) {
        $relative = Get-PmiaRelativePath -Root $sourceFull -Path $file.FullName
        if (Test-PmiaForbiddenRelativePath $relative) { continue }
        if ($file.Name -in @('deployment-manifest.json', 'checksums.sha256')) { continue }
        $target = Join-Path $Destination $relative
        $targetParent = Split-Path -Parent $target
        if ($targetParent) { New-Item -ItemType Directory -Force $targetParent | Out-Null }
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
    }
}

function Copy-PmiaAllowlistedSource {
    param([string]$SourceRoot, [string]$DestinationRoot)
    New-Item -ItemType Directory -Force $DestinationRoot | Out-Null
    foreach ($directory in $script:PmiaRootDirectories) {
        Copy-PmiaDirectoryFiltered -Source (Join-Path $SourceRoot $directory) `
            -Destination (Join-Path $DestinationRoot $directory)
    }
    foreach ($fileName in $script:PmiaRootFiles) {
        $source = Join-Path $SourceRoot $fileName
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $sourceItem = Get-Item -LiteralPath $source -Force
        if (($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Reparse point is not allowed in a PMIA package boundary: $source"
        }
        Copy-Item -LiteralPath $source -Destination (Join-Path $DestinationRoot $fileName) -Force
    }
}

function Get-PmiaGitCommit {
    param([string]$SourceRoot)
    try {
        $output = & git.exe -C $SourceRoot rev-parse HEAD 2>$null
        $exitCode = $LASTEXITCODE
    } catch {
        return ''
    }
    if ($exitCode -ne 0) { return '' }
    return ([string]($output | Select-Object -First 1)).Trim()
}

function Assert-PmiaGitClean {
    param([string]$SourceRoot)
    $status = & git.exe -C $SourceRoot status --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Source is not a Git repository: $SourceRoot" }
    if (($status | Out-String).Trim()) { throw "Source worktree is not clean: $SourceRoot" }
}

function Get-PmiaPackageStats {
    param([string]$PackageRoot)
    $files = @(Get-ChildItem -LiteralPath $PackageRoot -Recurse -File -Force |
        Where-Object Name -notin @('checksums.sha256', 'deployment-manifest.json'))
    $bytes = 0L
    foreach ($file in $files) { $bytes += [int64]$file.Length }
    return [pscustomobject]@{ fileCount = $files.Count; totalBytes = $bytes }
}

function Write-PmiaChecksums {
    param([string]$PackageRoot)
    $outputPath = Join-Path $PackageRoot 'checksums.sha256'
    $lines = foreach ($file in Get-ChildItem -LiteralPath $PackageRoot -Recurse -File -Force |
        Where-Object Name -ne 'checksums.sha256' |
        Sort-Object FullName) {
        $relative = (Get-PmiaRelativePath -Root $PackageRoot -Path $file.FullName).Replace('\', '/')
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToUpperInvariant()
        "$hash  $relative"
    }
    [IO.File]::WriteAllLines($outputPath, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))
    return $outputPath
}
