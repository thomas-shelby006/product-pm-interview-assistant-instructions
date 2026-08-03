param(
    [string]$ExtensionPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'extension'),
    [string]$EvidenceDirectory = (Join-Path $env:TEMP ("pmia-isolated-release-smoke-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))),
    [string]$BrowserPath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    [switch]$SkipLiveAnswer
)

$ErrorActionPreference = 'Stop'
$ExtensionPath = (Resolve-Path $ExtensionPath).Path
if (-not (Test-Path (Join-Path $ExtensionPath 'manifest.json'))) { throw "PMIA extension manifest missing: $ExtensionPath" }
if (-not (Test-Path $BrowserPath)) {
    $candidate = (Get-Command msedge.exe -ErrorAction SilentlyContinue).Source
    if (-not $candidate) { throw "Microsoft Edge not found: $BrowserPath" }
    $BrowserPath = $candidate
}

$runner = Join-Path $PSScriptRoot 'isolated-release-smoke.mjs'
if (-not (Test-Path $runner)) { throw "Isolated smoke runner missing: $runner" }
$node = (Get-Command node -ErrorAction Stop).Source
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sourceCommit = (& git -C $repositoryRoot rev-parse HEAD).Trim()
if (-not $sourceCommit) { throw 'Unable to resolve isolated-smoke source commit' }
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
$EvidenceDirectory = (Resolve-Path $EvidenceDirectory).Path
$profile = Join-Path $EvidenceDirectory 'temporary-edge-profile'
$evidencePath = Join-Path $EvidenceDirectory 'pmia-isolated-release-evidence.json'
New-Item -ItemType Directory -Force -Path $profile | Out-Null

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$edgeProcess = $null
$nodeExit = 1
$processClosed = $false
$profileRemoved = $false
function Get-OwnedEdgeProcesses([string]$OwnedProfile) {
    try {
        return @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object {
            $_.CommandLine -and $_.CommandLine.IndexOf($OwnedProfile, [StringComparison]::OrdinalIgnoreCase) -ge 0
        })
    } catch {
        return @()
    }
}
$arguments = @(
    "--user-data-dir=`"$profile`"",
    "--remote-debugging-port=$port",
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-component-extensions-with-background-pages',
    '--disable-features=msEdgeSidebarV2,msEdgeFirstRunExperience,msEdgeWelcomePage',
    "--disable-extensions-except=`"$ExtensionPath`"",
    "--load-extension=`"$ExtensionPath`"",
    '--window-position=2200,1000',
    '--window-size=1200,800',
    'about:blank'
)

try {
    $edgeProcess = Start-Process -FilePath $BrowserPath -ArgumentList $arguments -PassThru
    $deadline = (Get-Date).AddSeconds(25)
    $ready = $false
    while ((Get-Date) -lt $deadline -and -not $ready) {
        try {
            $client = [Net.Sockets.TcpClient]::new()
            $connect = $client.BeginConnect('127.0.0.1', $port, $null, $null)
            if ($connect.AsyncWaitHandle.WaitOne(250)) {
                $client.EndConnect($connect)
                $ready = $true
            }
            $client.Dispose()
        } catch {}
        if (-not $ready) { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw "Edge DevTools endpoint did not open on port $port" }

    $skipValue = if ($SkipLiveAnswer) { 'true' } else { 'false' }
    & $node $runner `
        --port $port `
        --extension-path $ExtensionPath `
        --profile-path $profile `
        --evidence $evidencePath `
        --source-commit $sourceCommit `
        --skip-live-answer $skipValue
    $nodeExit = $LASTEXITCODE
}
finally {
    if ($edgeProcess) {
        try { & taskkill /PID $edgeProcess.Id /T /F 2>$null | Out-Null } catch {}
    }
    for ($attempt = 0; $attempt -lt 10; $attempt += 1) {
        $ownedProcesses = @(Get-OwnedEdgeProcesses $profile)
        if ($ownedProcesses.Count -eq 0) { break }
        foreach ($owned in $ownedProcesses) {
            try { & taskkill /PID $owned.ProcessId /T /F 2>$null | Out-Null } catch {}
        }
        Start-Sleep -Milliseconds 250
    }
    $processClosed = @(Get-OwnedEdgeProcesses $profile).Count -eq 0
    Start-Sleep -Milliseconds 500
    for ($attempt = 0; $attempt -lt 6 -and (Test-Path $profile); $attempt += 1) {
        try { Remove-Item -Recurse -Force $profile -ErrorAction Stop } catch { Start-Sleep -Milliseconds 500 }
    }
    $profileRemoved = -not (Test-Path $profile)

    if (Test-Path $evidencePath) {
        try {
            $evidence = Get-Content $evidencePath -Raw | ConvertFrom-Json
            $evidence.cleanup = [pscustomobject]@{
                processTreeClosed = $processClosed
                profileRemoved = $profileRemoved
                completedAt = (Get-Date).ToUniversalTime().ToString('o')
            }
            $evidence.ok = [bool](
                $evidence.deterministicBrowser.ok `
                -and $processClosed `
                -and $profileRemoved
            )
            if ($evidence.releaseVerification) {
                $evidence.releaseVerification.packageReady = [bool]$evidence.ok
                $evidence.releaseVerification.activationReady = [bool](
                    $evidence.ok `
                    -and $evidence.providerCanary.status -eq 'passed' `
                    -and $evidence.releaseVerification.normalProfileActivation.ok
                )
            }
            [IO.File]::WriteAllText(
                $evidencePath,
                (($evidence | ConvertTo-Json -Depth 40) + [Environment]::NewLine),
                [Text.UTF8Encoding]::new($false)
            )
        } catch {
            Write-Warning "Could not patch cleanup evidence: $($_.Exception.Message)"
        }
    }
}

if ($nodeExit -ne 0) { throw "Isolated PMIA release smoke failed with exit code $nodeExit. Evidence: $evidencePath" }
if (-not $processClosed -or -not $profileRemoved) { throw "Isolated smoke cleanup failed. Evidence: $evidencePath" }
Write-Host 'PMIA isolated release smoke passed.'
Write-Host "Evidence: $evidencePath"