$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root "netlify-deploy"

& (Join-Path $root "Restore-BodyChart.ps1")
if ($LASTEXITCODE -ne 0) {
  Write-Host "Warning: body-chart.png was not installed. Run Restore-BodyChart.cmd or save body-chart-source.png" -ForegroundColor Yellow
}

$files = @(
  "index.html",
  "login.html",
  "login.js",
  "app.html",
  "sso-callback.html",
  "auth-config.js",
  "auth.js",
  "api-config.js",
  "clinic-sync.js",
  "patient-intake.html",
  "patient-intake.js",
  "patient-intake.css",
  "consent-page.js",
  "treatment-consent.html",
  "chiropractic-consent.html",
  "osteopathy-consent.html",
  "acupuncture-consent.html",
  "install-body-chart.html",
  "portal-theme.css",
  "portal-neumorph.css",
  "portal-ui-styles.css",
  "portal-mobile.css",
  "portal-calendar.css",
  "portal-dark.css",
  "portal-pdf.js",
  "netlify.toml",
  "Logo.png",
  "body-chart.png",
  "body-chart.embed.js"
)

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$copied = 0
foreach ($name in $files) {
  $src = Join-Path $root $name
  if (Test-Path $src) {
    Copy-Item $src $out -Force
    $copied++
  }
}

Write-Host "Prepared $copied files in netlify-deploy"
return $out
