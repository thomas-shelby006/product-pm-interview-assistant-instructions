param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('practice','real')]
    [string]$SessionType,

    [Parameter(Mandatory=$false)]
    [string]$Company = 'unknown',

    [Parameter(Mandatory=$false)]
    [string]$Role = 'pm',

    [Parameter(Mandatory=$false)]
    [string]$Round = 'unknown',

    [Parameter(Mandatory=$false)]
    [string]$Mode = 'mock',

    [Parameter(Mandatory=$true)]
    [string]$Win1File,

    [Parameter(Mandatory=$true)]
    [string]$Win2File,

    [Parameter(Mandatory=$true)]
    [string]$TrackerRepoPath,

    [Parameter(Mandatory=$false)]
    [switch]$NoAutoMerge
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
    $v = $v -replace '[^a-z0-9]+', '_'
    $v = $v.Trim('_')
    if ([string]::IsNullOrWhiteSpace($v)) { $v = $Fallback }
    if ($v.Length -gt 48) { $v = $v.Substring(0, 48).Trim('_') }
    return $v
}

function Run-Git([string[]]$Args, [string]$WorkingDirectory) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'git'
    foreach ($arg in $Args) { [void]$psi.ArgumentList.Add($arg) }
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) {
        throw "git $($Args -join ' ') failed`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
    }
    return $stdout.Trim()
}

Assert-FileExists $Win1File 'Win1 file'
Assert-FileExists $Win2File 'Win2 file'
Assert-DirectoryExists $TrackerRepoPath 'Tracker repo'

$gitStatus = Run-Git @('status','--porcelain') $TrackerRepoPath
if (-not [string]::IsNullOrWhiteSpace($gitStatus)) {
    throw "Tracker repo has uncommitted changes. Clean it before pushing a new session.`n$gitStatus"
}

$today = Get-Date -Format 'yyyy-MM-dd'
$companySlug = Slugify $Company 'unknown'
$roleSlug = Slugify $Role 'pm'
$roundSlug = Slugify $Round 'unknown'
$modeSlug = Slugify $Mode 'mock'

$root = Join-Path $TrackerRepoPath $SessionType
if (-not (Test-Path -LiteralPath $root)) {
    New-Item -ItemType Directory -Path $root | Out-Null
}

$existingNumbers = @()
Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -match '^(\d{4})_') { $existingNumbers += [int]$Matches[1] }
}
$nextNumber = 1
if ($existingNumbers.Count -gt 0) { $nextNumber = (($existingNumbers | Measure-Object -Maximum).Maximum + 1) }
$number = '{0:D4}' -f $nextNumber
$sessionId = "${number}_${today}_${companySlug}_${roleSlug}_${roundSlug}_${modeSlug}"
$sessionFolder = Join-Path $root $sessionId
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

Raw files:
- win1_sender.md
- win2_receiver.md

Review source:
Use these two files in the PM Interview Review Lab.
"@
Set-Content -LiteralPath (Join-Path $sessionFolder 'README.md') -Value $readme -Encoding UTF8

$branchName = "session/$sessionId"
Run-Git @('checkout','main') $TrackerRepoPath | Out-Null
Run-Git @('pull','--ff-only','origin','main') $TrackerRepoPath | Out-Null
Run-Git @('checkout','-b',$branchName) $TrackerRepoPath | Out-Null
Run-Git @('add',$SessionType) $TrackerRepoPath | Out-Null
Run-Git @('commit','-m',"session: add $sessionId") $TrackerRepoPath | Out-Null
Run-Git @('push','-u','origin',$branchName) $TrackerRepoPath | Out-Null

if (-not $NoAutoMerge) {
    Run-Git @('checkout','main') $TrackerRepoPath | Out-Null
    Run-Git @('pull','--ff-only','origin','main') $TrackerRepoPath | Out-Null
    Run-Git @('merge','--no-ff',$branchName,'-m',"merge session $sessionId") $TrackerRepoPath | Out-Null
    Run-Git @('push','origin','main') $TrackerRepoPath | Out-Null
    Run-Git @('branch','-d',$branchName) $TrackerRepoPath | Out-Null
    try { Run-Git @('push','origin','--delete',$branchName) $TrackerRepoPath | Out-Null } catch { Write-Warning "Could not delete remote branch $branchName. Delete manually if needed. $_" }
}

Write-Host "Session pushed successfully."
Write-Host "Session ID: $sessionId"
Write-Host "Session folder: $sessionFolder"
Write-Host "Branch: $branchName"
Write-Host "Auto-merged: $(-not $NoAutoMerge)"
