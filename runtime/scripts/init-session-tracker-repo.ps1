<#
.SYNOPSIS
    Initialize the local clone of the private pm-interview-session-tracker repo:
    create folders, a README, and an initial commit. Uses local git credentials only.
    Holds NO token. Does not create the GitHub repo itself (create it private first).

.EXAMPLE
    .\init-session-tracker-repo.ps1 -TrackerRepoPath "C:\Users\Sundar\Documents\pm-interview-session-tracker"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TrackerRepoPath,
    [switch]$Push
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath (Join-Path $TrackerRepoPath '.git'))) {
    Write-Host "FAIL: not a git repo (clone the private repo first): $TrackerRepoPath" -ForegroundColor Red
    exit 1
}

foreach ($d in @('practice', 'real', 'reviews', 'patterns')) {
    $p = Join-Path $TrackerRepoPath $d
    if (-not (Test-Path -LiteralPath $p)) {
        New-Item -ItemType Directory -Path $p | Out-Null
        # keep empty dirs in git
        Set-Content -LiteralPath (Join-Path $p '.gitkeep') -Value '' -Encoding UTF8
    }
}

$readmePath = Join-Path $TrackerRepoPath 'README.md'
if (-not (Test-Path -LiteralPath $readmePath)) {
    @"
# PM Interview Session Tracker

Private, append-only store of practice/real interview sessions.

- ``practice/`` practice + mock sessions
- ``real/``     real (live-mock) sessions (sensitive)
- ``reviews/``  optional Review Lab outputs
- ``patterns/`` optional recurring-pattern notes

Each session folder holds ``win1_sender.md`` + ``win2_receiver.md`` + ``README.md``.
Session branches may auto-merge (append-only data). Keep this repo PRIVATE.
"@ | Set-Content -LiteralPath $readmePath -Encoding UTF8
}

& git -C $TrackerRepoPath add . | Out-Null
$status = & git -C $TrackerRepoPath status --porcelain
if ($status) {
    & git -C $TrackerRepoPath commit -m "init: tracker structure (practice/real/reviews/patterns)" | Out-Null
    Write-Host "OK: committed tracker structure" -ForegroundColor Green
    if ($Push) {
        & git -C $TrackerRepoPath push -u origin HEAD | Out-Null
        Write-Host "OK: pushed" -ForegroundColor Green
    } else {
        Write-Host "Run with -Push to push, or push manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "Nothing to commit (already initialized)." -ForegroundColor Yellow
}
