[CmdletBinding()]
param(
    [string]$UserDataRoot = (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'),
    [string]$ExpectedExtensionPath = '',
    [string]$ProfileDirectory = ''
)

$ErrorActionPreference = 'Stop'

function ConvertTo-PmiaSafeField {
    param([AllowNull()][object]$Value)
    return ([string]$Value) -replace "[\t\r\n]", ' '
}

function Resolve-PmiaPathValue {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
    try {
        $item = Get-Item -LiteralPath $Path -Force
        if ($item.LinkType -and $item.Target) {
            $target = @($item.Target)[0]
            if (-not [IO.Path]::IsPathRooted($target)) {
                $target = Join-Path $item.Parent.FullName $target
            }
            return [IO.Path]::GetFullPath($target).TrimEnd('\').ToLowerInvariant()
        }
        return [IO.Path]::GetFullPath($item.FullName).TrimEnd('\').ToLowerInvariant()
    } catch {
        return [IO.Path]::GetFullPath($Path).TrimEnd('\').ToLowerInvariant()
    }
}

function Get-PmiaExpectedVersion {
    param([string]$ExtensionPath)
    $manifestPath = Join-Path $ExtensionPath 'manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath)) { return '' }
    try {
        return [string]((Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json).version)
    } catch {
        return ''
    }
}

function Find-PmiaExtensionEntry {
    param([object]$Settings, [string]$ExpectedResolvedPath)
    if ($null -eq $Settings) { return $null }
    $fallback = $null
    foreach ($property in $Settings.PSObject.Properties) {
        $entry = $property.Value
        $path = [string]$entry.path
        if ([string]::IsNullOrWhiteSpace($path)) { continue }
        $resolved = Resolve-PmiaPathValue $path
        $candidate = [pscustomobject]@{
            Id = $property.Name
            Entry = $entry
            RegisteredPath = $path
            ResolvedPath = $resolved
        }
        if ($ExpectedResolvedPath -and $resolved -eq $ExpectedResolvedPath) { return $candidate }
        if ($path -match '(?i)product-pm-interview-assistant-instructions.*[\\/]runtime[\\/]extension$') {
            $fallback = $candidate
        }
    }
    return $fallback
}

function Get-PmiaEdgeProfiles {
    param(
        [string]$Root,
        [string]$ExpectedPath,
        [string]$OnlyProfile = ''
    )
    if (-not (Test-Path -LiteralPath $Root)) { return @() }
    $expectedResolved = Resolve-PmiaPathValue $ExpectedPath
    $expectedVersion = Get-PmiaExpectedVersion $ExpectedPath
    $directories = Get-ChildItem -LiteralPath $Root -Directory | Where-Object {
        Test-Path -LiteralPath (Join-Path $_.FullName 'Preferences')
    }
    if ($OnlyProfile) {
        $directories = $directories | Where-Object Name -eq $OnlyProfile
    }
    $rows = @()
    foreach ($directory in $directories) {
        $displayName = $directory.Name
        try {
            $preferences = Get-Content -Raw -LiteralPath (Join-Path $directory.FullName 'Preferences') | ConvertFrom-Json
            if ($preferences.profile.name) { $displayName = [string]$preferences.profile.name }
        } catch {}
        $secure = $null
        try {
            $securePath = Join-Path $directory.FullName 'Secure Preferences'
            if (Test-Path -LiteralPath $securePath) {
                $secure = Get-Content -Raw -LiteralPath $securePath | ConvertFrom-Json
            }
        } catch {}
        $candidate = Find-PmiaExtensionEntry $secure.extensions.settings $expectedResolved
        $rows += New-PmiaProfileRow $directory.Name $displayName $candidate $expectedResolved $expectedVersion
    }
    return $rows
}

function New-PmiaProfileRow {
    param(
        [string]$Directory,
        [string]$DisplayName,
        [AllowNull()][object]$Candidate,
        [string]$ExpectedResolvedPath,
        [string]$ExpectedVersion
    )
    $extensionId = ''
    $registeredPath = ''
    $resolvedPath = ''
    $version = ''
    $pathMatches = $false
    $issueCode = 'OK'
    $issueMessage = 'PMIA extension registration matches this profile.'
    if ($null -eq $Candidate) {
        $issueCode = 'EXTENSION_NOT_REGISTERED'
        $issueMessage = 'PMIA is not registered in this Edge profile.'
    } else {
        $extensionId = [string]$Candidate.Id
        $registeredPath = [string]$Candidate.RegisteredPath
        $resolvedPath = [string]$Candidate.ResolvedPath
        $version = [string]$Candidate.Entry.service_worker_registration_info.version
        $pathMatches = [bool]($ExpectedResolvedPath -and $resolvedPath -eq $ExpectedResolvedPath)
        if (-not $pathMatches) {
            $issueCode = 'EXTENSION_PATH_MISMATCH'
            $issueMessage = 'PMIA points to a different unpacked-extension directory.'
        } elseif ($ExpectedVersion -and $version -ne $ExpectedVersion) {
            $issueCode = 'EXTENSION_VERSION_MISMATCH'
            $issueMessage = "PMIA reports version $version; expected $ExpectedVersion."
        }
    }
    return [pscustomobject]@{
        directory = $Directory; displayName = $DisplayName; extensionId = $extensionId
        registeredPath = $registeredPath; resolvedPath = $resolvedPath; version = $version
        pathMatches = $pathMatches; issueCode = $issueCode; issueMessage = $issueMessage
    }
}

$columns = @('directory','displayName','extensionId','registeredPath','resolvedPath','version','pathMatches','issueCode','issueMessage')
$columns -join "`t"
$profiles = Get-PmiaEdgeProfiles -Root $UserDataRoot -ExpectedPath $ExpectedExtensionPath -OnlyProfile $ProfileDirectory
foreach ($profile in $profiles) {
    $values = foreach ($column in $columns) {
        ConvertTo-PmiaSafeField $profile.$column
    }
    $values -join "`t"
}
