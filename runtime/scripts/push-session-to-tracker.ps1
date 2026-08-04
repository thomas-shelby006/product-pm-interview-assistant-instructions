param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('practice','real')]
    [string]$SessionType,
    [string]$Company = 'unknown',
    [string]$Role = 'pm',
    [string]$Round = 'unknown',
    [string]$Mode = 'mock',
    [Parameter(Mandatory=$true)]
    [string]$Win1File,
    [Parameter(Mandatory=$true)]
    [string]$Win2File,
    [Parameter(Mandatory=$true)]
    [string]$TrackerRepoPath,
    [switch]$DryRun,
    [string]$DryRunOutputPath = '',
    [string]$ResultJsonPath = '',
    [switch]$NoAutoMerge
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Result([hashtable]$Value) {
    if ([string]::IsNullOrWhiteSpace($ResultJsonPath)) { return }
    $parent = Split-Path -Parent $ResultJsonPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $json = $Value | ConvertTo-Json -Depth 5 -Compress
    [IO.File]::WriteAllText($ResultJsonPath, $json, [Text.UTF8Encoding]::new($false))
}

function Assert-FileExists([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label not found: $Path"
    }
}

function Assert-DirectoryExists([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Label not found: $Path"
    }
}

function Slugify([string]$Value, [string]$Fallback) {
    $v = if ($null -eq $Value) { '' } else { $Value.Trim().ToLowerInvariant() }
    if ([string]::IsNullOrWhiteSpace($v)) { $v = $Fallback }
    $v = ($v -replace '[^a-z0-9]+', '_').Trim('_')
    if ([string]::IsNullOrWhiteSpace($v)) { $v = $Fallback }
    if ($v.Length -gt 48) { $v = $v.Substring(0, 48).Trim('_') }
    return $v
}

function Run-Git([string[]]$GitArgs, [string]$WorkingDirectory) {
    Push-Location -LiteralPath $WorkingDirectory
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git @GitArgs 2>&1
        $exitCode = $LASTEXITCODE
        $text = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        if ($exitCode -ne 0) {
            throw "git $($GitArgs -join ' ') failed`n$text"
        }
        return $text.Trim()
    }
    finally {
        $ErrorActionPreference = $previousPreference
        Pop-Location
    }
}

function Read-PmiaExportHeader([string]$Path) {
    $sessionId = ''
    $role = ''
    $provider = ''
    foreach ($line in Get-Content -LiteralPath $Path -ErrorAction Stop) {
        if (-not $sessionId -and $line -match '^Session:\s*(\S+)\s*$') {
            $sessionId = $Matches[1]
            continue
        }
        if (-not $role -and $line -match '^Window:\s*(sender|receiver)\s*/\s*(chatgpt|claude)\s*$') {
            $role = $Matches[1].ToLowerInvariant()
            $provider = $Matches[2].ToLowerInvariant()
        }
        if ($sessionId -and $role) { break }
    }
    return [pscustomobject]@{
        valid = [bool]($sessionId -and $role)
        sessionId = $sessionId
        role = $role
        provider = $provider
    }
}

function Validate-ExportPair([string]$SenderPath, [string]$ReceiverPath) {
    $sender = Read-PmiaExportHeader $SenderPath
    $receiver = Read-PmiaExportHeader $ReceiverPath
    if (-not $sender.valid -or -not $receiver.valid) {
        throw 'Malformed PMIA export pair. Both files must use the extension-native PMIA Markdown headers.'
    }
    if ($sender.role -ne 'sender') {
        throw "Win1 file declares role '$($sender.role)' instead of sender."
    }
    if ($receiver.role -ne 'receiver') {
        throw "Win2 file declares role '$($receiver.role)' instead of receiver."
    }
    if ($sender.sessionId -ne $receiver.sessionId) {
        throw "PMIA session mismatch: sender '$($sender.sessionId)' and receiver '$($receiver.sessionId)'."
    }
    return [pscustomobject]@{
        sourceSessionId = $sender.sessionId
        senderProvider = $sender.provider
        receiverProvider = $receiver.provider
    }
}

function Next-SessionNumber([string]$Root) {
    $existingNumbers = @()
    Get-ChildItem -LiteralPath $Root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Name -match '^(\d{4})_') { $existingNumbers += [int]$Matches[1] }
    }
    if ($existingNumbers.Count -eq 0) { return '0001' }
    $next = [int](($existingNumbers | Measure-Object -Maximum).Maximum) + 1
    return $next.ToString('D4')
}

function New-SessionFolder(
    [string]$Root,
    [string]$Number,
    [pscustomobject]$Pair
) {
    $today = Get-Date -Format 'yyyy-MM-dd'
    $companySlug = Slugify $Company 'unknown'
    $roleSlug = Slugify $Role 'pm'
    $roundSlug = Slugify $Round 'unknown'
    $modeSlug = Slugify $Mode 'mock'
    $sessionId = "${Number}_${today}_${companySlug}_${roleSlug}_${roundSlug}_${modeSlug}"
    $sessionFolder = Join-Path $Root $sessionId
    if (Test-Path -LiteralPath $sessionFolder) {
        throw "Session folder already exists: $sessionFolder"
    }
    New-Item -ItemType Directory -Path $sessionFolder | Out-Null
    Copy-Item -LiteralPath $Win1File -Destination (Join-Path $sessionFolder 'win1_sender.md')
    Copy-Item -LiteralPath $Win2File -Destination (Join-Path $sessionFolder 'win2_receiver.md')
    $readme = @"
# $sessionId

Session type: $SessionType
Company: $Company
Role: $Role
Round: $Round
Mode: $Mode
Created: $(Get-Date -Format o)
Source format: pmia-schema-2.1
Source PMIA session: $($Pair.sourceSessionId)
Sender provider: $($Pair.senderProvider)
Receiver provider: $($Pair.receiverProvider)

Raw files:
- win1_sender.md
- win2_receiver.md

Review source:
Use these two files in the PM Interview Review Lab.
"@
    [IO.File]::WriteAllText((Join-Path $sessionFolder 'README.md'), $readme, [Text.UTF8Encoding]::new($false))
    return [pscustomobject]@{ id = $sessionId; folder = $sessionFolder }
}

try {
    Assert-FileExists $Win1File 'Win1 file'
    Assert-FileExists $Win2File 'Win2 file'
    Assert-DirectoryExists $TrackerRepoPath 'Tracker repo'
    $pair = Validate-ExportPair $Win1File $Win2File

    if ($DryRun) {
        if ([string]::IsNullOrWhiteSpace($DryRunOutputPath)) {
            $DryRunOutputPath = Join-Path ([IO.Path]::GetTempPath()) 'PMInterviewAssistant\tracker-dry-run'
        }
        $root = Join-Path $DryRunOutputPath $SessionType
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        $created = New-SessionFolder $root (Next-SessionNumber $root) $pair
        $relativePath = "$SessionType/$($created.id)"
        $result = @{
            ok = $true
            sessionId = $created.id
            sourceSessionId = $pair.sourceSessionId
            sessionFolder = $created.folder
            trackerRelativePath = $relativePath
            branch = ''
            autoMerged = $false
            dryRun = $true
            error = ''
        }
        Write-Result $result
        Write-Host 'Dry run completed.'
        Write-Host "Session ID: $($created.id)"
        Write-Host "Session folder: $($created.folder)"
        Write-Host 'No Git commit, branch, merge, or remote write was performed.'
        exit 0
    }

    $gitStatus = Run-Git @('status','--porcelain') $TrackerRepoPath
    if (-not [string]::IsNullOrWhiteSpace($gitStatus)) {
        throw "Tracker repo has uncommitted changes. Clean it before pushing a new session.`n$gitStatus"
    }
    Run-Git @('checkout','main') $TrackerRepoPath | Out-Null
    Run-Git @('pull','--ff-only','origin','main') $TrackerRepoPath | Out-Null

    $root = Join-Path $TrackerRepoPath $SessionType
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $created = New-SessionFolder $root (Next-SessionNumber $root) $pair
    $branchName = "session/$($created.id)"
    Run-Git @('checkout','-b',$branchName) $TrackerRepoPath | Out-Null
    Run-Git @('add',$SessionType) $TrackerRepoPath | Out-Null
    Run-Git @('commit','-m',"session: add $($created.id)") $TrackerRepoPath | Out-Null
    Run-Git @('push','-u','origin',$branchName) $TrackerRepoPath | Out-Null

    $autoMerged = $false
    if (-not $NoAutoMerge) {
        Run-Git @('checkout','main') $TrackerRepoPath | Out-Null
        Run-Git @('pull','--ff-only','origin','main') $TrackerRepoPath | Out-Null
        Run-Git @('merge','--no-ff',$branchName,'-m',"merge session $($created.id)") $TrackerRepoPath | Out-Null
        Run-Git @('push','origin','main') $TrackerRepoPath | Out-Null
        Run-Git @('branch','-d',$branchName) $TrackerRepoPath | Out-Null
        Run-Git @('push','origin','--delete',$branchName) $TrackerRepoPath | Out-Null
        $autoMerged = $true
    }

    $result = @{
        ok = $true
        sessionId = $created.id
        sourceSessionId = $pair.sourceSessionId
        sessionFolder = $created.folder
        trackerRelativePath = "$SessionType/$($created.id)"
        branch = $branchName
        autoMerged = $autoMerged
        dryRun = $false
        error = ''
    }
    Write-Result $result
    Write-Host 'Session pushed successfully.'
    Write-Host "Session ID: $($created.id)"
    Write-Host "Session folder: $($created.folder)"
    Write-Host "Branch: $branchName"
    Write-Host "Auto-merged: $autoMerged"
    exit 0
}
catch {
    $message = $_.Exception.Message
    Write-Result @{ ok = $false; dryRun = [bool]$DryRun; error = $message }
    Write-Error $message
    exit 1
}
