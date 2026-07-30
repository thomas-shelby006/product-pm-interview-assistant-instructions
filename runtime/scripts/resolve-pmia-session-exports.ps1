param(
    [Parameter(Mandatory=$true)]
    [string]$DownloadDirectory,
    [Parameter(Mandatory=$true)]
    [string]$SessionId,
    [Parameter(Mandatory=$true)]
    [datetime]$SinceUtc,
    [Parameter(Mandatory=$false)]
    [ValidateRange(0,120)]
    [int]$WaitSeconds = 20,
    [Parameter(Mandatory=$true)]
    [string]$ResultJsonPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Result([hashtable]$Value, [int]$ExitCode) {
    $parent = Split-Path -Parent $ResultJsonPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $json = $Value | ConvertTo-Json -Depth 5 -Compress
    [IO.File]::WriteAllText($ResultJsonPath, $json, [Text.UTF8Encoding]::new($false))
    exit $ExitCode
}

function Fail([string]$Message, [int]$ExitCode = 2) {
    Write-Result @{ ok = $false; sessionId = $SessionId; error = $Message } $ExitCode
}
function Read-ExportHeader([string]$Path) {
    $session = ''
    $role = ''
    $provider = ''
    foreach ($line in Get-Content -LiteralPath $Path -ErrorAction Stop) {
        if (-not $session -and $line -match '^Session:\s*(\S+)\s*$') {
            $session = $Matches[1]
            continue
        }
        if (-not $role -and $line -match '^Window:\s*(sender|receiver)\s*/\s*(chatgpt|claude)\s*$') {
            $role = $Matches[1].ToLowerInvariant()
            $provider = $Matches[2].ToLowerInvariant()
        }
        if ($session -and $role) { break }
    }
    if (-not $session -or -not $role) {
        return [pscustomobject]@{ valid = $false; path = $Path; error = 'Malformed PMIA Markdown header' }
    }
    return [pscustomobject]@{
        valid = $true
        path = $Path
        sessionId = $session
        role = $role
        provider = $provider
    }
}

if (-not (Test-Path -LiteralPath $DownloadDirectory -PathType Container)) {
    Fail "Download directory not found: $DownloadDirectory"
}
if ([string]::IsNullOrWhiteSpace($SessionId)) {
    Fail 'Session ID is empty'
}

$deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
$pattern = "pmia-session-$SessionId-*.md"
$lastProblem = ''
do {
    $files = @(Get-ChildItem -LiteralPath $DownloadDirectory -File -Filter $pattern -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTimeUtc -ge $SinceUtc.ToUniversalTime() } |
        Sort-Object LastWriteTimeUtc)

    $headers = @()
    foreach ($file in $files) {
        $headers += Read-ExportHeader $file.FullName
    }

    $malformed = @($headers | Where-Object { -not $_.valid })
    if ($malformed.Count -gt 0) {
        Fail "Malformed PMIA export for session ${SessionId}: $($malformed[0].path)"
    }

    $mismatched = @($headers | Where-Object { $_.valid -and $_.sessionId -ne $SessionId })
    if ($mismatched.Count -gt 0) {
        Fail "Session header mismatch in export: $($mismatched[0].path)"
    }

    $valid = @($headers | Where-Object { $_.valid -and $_.sessionId -eq $SessionId })
    $senders = @($valid | Where-Object role -eq 'sender')
    $receivers = @($valid | Where-Object role -eq 'receiver')

    if ($senders.Count -gt 1) {
        Fail "Duplicate sender exports found for session $SessionId"
    }
    if ($receivers.Count -gt 1) {
        Fail "Duplicate receiver exports found for session $SessionId"
    }

    if ($senders.Count -eq 1 -and $receivers.Count -eq 1) {
        Write-Result @{
            ok = $true
            sessionId = $SessionId
            senderFile = $senders[0].path
            receiverFile = $receivers[0].path
            senderProvider = $senders[0].provider
            receiverProvider = $receivers[0].provider
            error = ''
        } 0
    }

    $lastProblem = "Expected one sender and one receiver export; found $($senders.Count) sender and $($receivers.Count) receiver"
    if ([DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
} while ([DateTime]::UtcNow -lt $deadline)

Fail "PMIA export pair not found or stale for session $SessionId. $lastProblem" 3