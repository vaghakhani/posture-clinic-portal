param(
  [string]$WebsiteApp = "",
  [string]$Dst = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$websiteApp = Join-Path $root "..\Posture Clinic Website\app.html"
$deployDir = Join-Path $root "netlify-deploy"
$deploy = Join-Path $deployDir "app.html"

if (-not $Dst) { $Dst = Join-Path $root "app.html" }

if (Test-Path -LiteralPath $websiteApp) {
  $text = [IO.File]::ReadAllText($websiteApp)
  if ($text -match 'PosturePortalAuth\.requireAppAccess') {
    [IO.File]::WriteAllText($Dst, $text)
    New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
    [IO.File]::WriteAllText($deploy, $text)
    Write-Host "Portal app.html: $Dst ($((Get-Item -LiteralPath $Dst).Length) bytes)"
    Write-Host "Netlify app.html: $deploy ($((Get-Item -LiteralPath $deploy).Length) bytes)"
    exit 0
  }
}

& (Join-Path $root "Migrate-Portal.ps1")
$src = Join-Path $root "app.html"
$deployDir = Join-Path $root "netlify-deploy"
$deploy = Join-Path $deployDir "app.html"
if (-not (Test-Path -LiteralPath $src)) { Write-Error "app.html missing after migrate: $src"; exit 1 }
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
Copy-Item -LiteralPath $src -Destination $deploy -Force
$f = Get-Item -LiteralPath $src
Write-Host "Portal app.html: $($f.FullName) ($($f.Length) bytes)"
Write-Host "Netlify app.html: $deploy ($((Get-Item -LiteralPath $deploy).Length) bytes)"
