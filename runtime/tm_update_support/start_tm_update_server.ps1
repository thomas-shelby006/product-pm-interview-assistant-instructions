# Optional Tampermonkey update server
# Run this only when you want Tampermonkey @updateURL/@downloadURL checks to work locally.
# Main runtime remains Final_2_Window_Fixed.ahk.

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    $python = Get-Command py -ErrorAction SilentlyContinue
}

if (-not $python) {
    Write-Host "Python was not found. Install Python or serve this folder at http://127.0.0.1:8123 manually."
    exit 1
}

Write-Host "Serving Tampermonkey scripts from: $Root"
Write-Host "URL base: http://127.0.0.1:8123"
Write-Host "Stop with Ctrl+C."

if ($python.Source -like "*\\py.exe") {
    & $python.Source -m http.server 8123 --bind 127.0.0.1
} else {
    & $python.Source -m http.server 8123 --bind 127.0.0.1
}
