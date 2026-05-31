param(
    [Parameter(Mandatory=$true)]
    [string]$TrackerRepoPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $TrackerRepoPath -PathType Container)) {
    New-Item -ItemType Directory -Path $TrackerRepoPath | Out-Null
}

foreach ($dir in @('practice','real','reviews','patterns')) {
    $path = Join-Path $TrackerRepoPath $dir
    if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
    $keep = Join-Path $path '.gitkeep'
    if (-not (Test-Path -LiteralPath $keep)) { Set-Content -LiteralPath $keep -Value '' -Encoding UTF8 }
}

$readme = Join-Path $TrackerRepoPath 'README.md'
if (-not (Test-Path -LiteralPath $readme)) {
    Set-Content -LiteralPath $readme -Encoding UTF8 -Value @'
# PM Interview Session Tracker

Private repo for PM interview practice/live session evidence and ChatGPT review outputs.

Session files:
- practice/<session_id>/win1_sender.md
- practice/<session_id>/win2_receiver.md
- real/<session_id>/win1_sender.md
- real/<session_id>/win2_receiver.md

Review files can be added later under reviews/ and patterns/.
'@
}

Write-Host "Tracker structure initialized at: $TrackerRepoPath"
