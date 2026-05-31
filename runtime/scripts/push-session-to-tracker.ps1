<#
.SYNOPSIS
    Package two exported session files into the private PM interview session tracker
    repo and push them on a session branch (optionally auto-merging to main).

.DESCRIPTION
    Append-only data workflow. The tracker repo is SEPARATE from the instruction repo.
    This script uses your LOCAL git credentials (credential manager / SSH). It contains
    NO GitHub token and writes none anywhere. It never touches the instruction repo.

.EXAMPLE
    .\push-session-to-tracker.ps1 -SessionType practice -Company Pemo -Role PM `
        -Round behavioral -Mode mock `
        -Win1File "$HOME\Downloads\pm_session_..._win1_sender.md" `
        -Win2File "$HOME\Downloads\pm_session_..._win2_receiver.md" `
        -TrackerRepoPath "C:\Users\Sundar\Documents\pm-interview-session-tracker"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateSet('practice', 'real')][string]$SessionType,
    [Parameter(Mandatory = $true)][string]$Company,
    [Parameter(Mandatory = $true)][string]$Role,
    [Parameter(Mandatory = $true)][string]$Round,
    [Parameter(Mandatory = $true)][string]$Mode,
    [Parameter(Mandatory = $true)][string]$Win1File,
    [Parameter(Mandatory = $true)][string]$Win2File,
    [Parameter(Mandatory = $true)][string]$TrackerRepoPath,
    [switch]$NoAutoMerge
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "OK  $msg" -ForegroundColor Green }
function Fail([string]$msg)       { Write-Host "FAIL $msg" -ForegroundColor Red; exit 1 }

# Run git inside the tracker repo and stop on non-zero exit.
function Git-Tracker {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $out = & git -C $TrackerRepoPath @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail ("git " + ($Args -join ' ') + "`n" + ($out -join "`n"))
    }
    return $out
}

function Slug([string]$s) {
    if ([string]::IsNullOrWhiteSpace($s)) { return 'unknown' }
    $x = $s.ToLowerInvariant().Trim()
    $x = $x -replace '[^a-z0-9]+', '_'
    $x = $x -replace '_+', '_'
    $x = $x.Trim('_')
    if ([string]::IsNullOrWhiteSpace($x)) { return 'unknown' }
    if ($x.Length -gt 24) { $x = $x.Substring(0, 24).Trim('_') }
    return $x
}

# 1. Validate input files
Write-Step 'Validating input files'
if (-not (Test-Path -LiteralPath $Win1File -PathType Leaf)) { Fail "Win1 file not found: $Win1File" }
if (-not (Test-Path -LiteralPath $Win2File -PathType Leaf)) { Fail "Win2 file not found: $Win2File" }
Write-Ok 'Both window files exist'

# 2. Validate tracker repo exists and is clean
Write-Step 'Validating tracker repo'
if (-not (Test-Path -LiteralPath (Join-Path $TrackerRepoPath '.git'))) {
    Fail "Tracker repo is not a git repo (no .git): $TrackerRepoPath"
}
$status = Git-Tracker status --porcelain
if ($status) { Fail "Tracker repo is dirty. Commit/stash first:`n$($status -join "`n")" }
Write-Ok 'Tracker repo present and clean'

# Make sure practice/ and real/ exist
foreach ($d in @('practice', 'real')) {
    $p = Join-Path $TrackerRepoPath $d
    if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

# 3. Determine next session number across BOTH practice/ and real/
Write-Step 'Determining next session number'
$maxNum = 0
foreach ($d in @('practice', 'real')) {
    $base = Join-Path $TrackerRepoPath $d
    Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Name -match '^(\d{4})_') {
            $n = [int]$Matches[1]
            if ($n -gt $maxNum) { $maxNum = $n }
        }
    }
}
$nextNum = '{0:D4}' -f ($maxNum + 1)

# 4. Build session id
$date = (Get-Date).ToString('yyyy-MM-dd')
$sessionId = "${nextNum}_${date}_$(Slug $Company)_$(Slug $Role)_$(Slug $Round)_$(Slug $Mode)"
Write-Ok "session_id = $sessionId"

# 5. Create folder
$sessionDir = Join-Path (Join-Path $TrackerRepoPath $SessionType) $sessionId
if (Test-Path -LiteralPath $sessionDir) { Fail "Session folder already exists: $sessionDir" }
New-Item -ItemType Directory -Path $sessionDir | Out-Null

# 6. Copy the two raw files to canonical names
Copy-Item -LiteralPath $Win1File -Destination (Join-Path $sessionDir 'win1_sender.md') -Force
Copy-Item -LiteralPath $Win2File -Destination (Join-Path $sessionDir 'win2_receiver.md') -Force

# 7. Simple README in the session folder
$readme = @"
# Session $sessionId

- type: $SessionType
- company: $Company
- role: $Role
- round: $Round
- mode: $Mode
- created: $((Get-Date).ToString('o'))

Files:
- ``win1_sender.md``   interviewer transcript / input / blocked / forwarding (Win1)
- ``win2_receiver.md`` received questions / answers / manual Win2 prompts (Win2)

Review with the ChatGPT Review Lab using ``templates/session-tracker/review_lab_prompt.md``
in the instruction repo. Do not auto-update the instruction repo from a review.
"@
Set-Content -LiteralPath (Join-Path $sessionDir 'README.md') -Value $readme -Encoding UTF8

# 8-10. Branch, commit, push
$branch = "session/$sessionId"
Write-Step "Creating branch $branch"
Git-Tracker checkout main | Out-Null
Git-Tracker checkout -b $branch | Out-Null
Git-Tracker add -- "$SessionType/$sessionId" | Out-Null
Git-Tracker commit -m "session: add $sessionId" | Out-Null
Write-Step "Pushing $branch"
Git-Tracker push -u origin $branch | Out-Null
Write-Ok "Pushed branch $branch"

# 11. Auto-merge (tracker repo only; append-only data => safe)
if ($NoAutoMerge) {
    Write-Ok "NoAutoMerge set. Branch pushed; merge it manually when ready."
} else {
    Write-Step 'Auto-merging into main (append-only data)'
    Git-Tracker checkout main | Out-Null
    Git-Tracker pull --ff-only | Out-Null
    Git-Tracker merge --no-ff $branch -m "merge $branch" | Out-Null
    Git-Tracker push origin main | Out-Null
    Git-Tracker branch -d $branch | Out-Null
    & git -C $TrackerRepoPath push origin --delete $branch 2>&1 | Out-Null  # best-effort remote cleanup
    Write-Ok "Merged $sessionId into main and cleaned up the branch"
}

Write-Host ""
Write-Ok "DONE: $SessionType/$sessionId"
Write-Host "Next: run the Review Lab on win1_sender.md + win2_receiver.md." -ForegroundColor Yellow
