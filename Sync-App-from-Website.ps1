$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root "..\Posture Clinic Website\app.html"
if (-not (Test-Path -LiteralPath $src)) {
  Write-Error "Source not found: $src"
  exit 1
}
$portalApp = Join-Path $root "app.html"
$deployApp = Join-Path $root "netlify-deploy\app.html"
Copy-Item -LiteralPath $src -Destination $portalApp -Force
New-Item -ItemType Directory -Path (Split-Path $deployApp) -Force | Out-Null
Copy-Item -LiteralPath $src -Destination $deployApp -Force
Write-Host "Synced app.html -> $portalApp ($((Get-Item $portalApp).Length) bytes)"
Write-Host "Synced app.html -> $deployApp ($((Get-Item $deployApp).Length) bytes)"
