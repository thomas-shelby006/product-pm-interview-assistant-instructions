# PMIA 0.12.1 release gate. Requires Node, Windows PowerShell, and Edge for isolated browser smokes.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $PSScriptRoot 'extension'
$launcher = Join-Path $PSScriptRoot 'Launch_PMIA_Studio.ps1'
$transportSmoke = Join-Path $PSScriptRoot 'scripts\run-simple-isolated-smoke.mjs'
$providerSmoke = Join-Path $PSScriptRoot 'scripts\run-simple-provider-fixture-smoke.mjs'

foreach ($path in @((Join-Path $extension 'manifest.json'), $launcher, $transportSmoke, $providerSmoke)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "PMIA release dependency missing: $path"
    }
}

Push-Location $repo
try {
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "Active PMIA tests failed with exit code $LASTEXITCODE" }

    & npm run validate
    if ($LASTEXITCODE -ne 0) { throw "Extension validation failed with exit code $LASTEXITCODE" }

    # Test the real launcher in dry-run mode: no browser launch, profile changes, or credentials.
    # An explicit, syntactically valid ID keeps this portable across unpacked-extension paths.
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher -ExtensionDir $extension -ExtensionId 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' -ValidateOnly
    if ($LASTEXITCODE -ne 0) { throw "PowerShell launcher validation failed with exit code $LASTEXITCODE" }

    & node $transportSmoke
    if ($LASTEXITCODE -ne 0) { throw "Isolated Edge transport smoke failed with exit code $LASTEXITCODE" }

    & node $providerSmoke
    if ($LASTEXITCODE -ne 0) { throw "Provider fixture smoke failed with exit code $LASTEXITCODE" }

    Write-Host 'PMIA 0.12.1 active runtime validation passed.'
    Write-Host "Extension: $extension"
    Write-Host "Studio:    $(Join-Path $extension 'studio\index.html')"
    Write-Host "Cockpit:   $(Join-Path $extension 'cockpit\index.html')"
    Write-Host "Launcher:  $launcher"
}
finally {
    Pop-Location
}
