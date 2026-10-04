# Deploy Posture Clinic Portal to Netlify from PowerShell
# One-time setup:
#   npm install -g netlify-cli
#   netlify login
#   netlify link          (choose site: postureclinicportal)
#
# Or set a token (Netlify -> User settings -> Personal access tokens):
#   $env:NETLIFY_AUTH_TOKEN = "your-token-here"

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "Posture Clinic Portal - Netlify deploy"
Write-Host "======================================="
Write-Host ""

$deployDir = & (Join-Path $root "Prepare-Netlify-Deploy.ps1")
Write-Host ""

function Get-NetlifyCli {
  $cmd = Get-Command netlify -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $npx = Get-Command npx -ErrorAction SilentlyContinue
  if ($npx) { return "npx netlify-cli" }
  return $null
}

$cli = Get-NetlifyCli
if (-not $cli) {
  Write-Host "Netlify CLI not found." -ForegroundColor Red
  Write-Host ""
  Write-Host "Install it once:"
  Write-Host "  npm install -g netlify-cli"
  Write-Host ""
  Write-Host "Then run:"
  Write-Host "  netlify login"
  Write-Host "  netlify link"
  Write-Host "  .\Deploy-Netlify.ps1"
  Write-Host ""
  exit 1
}

Write-Host "Using: $cli"
Write-Host "Deploy folder: $deployDir"
Write-Host ""

if ($cli -eq "npx netlify-cli") {
  & npx --yes netlify-cli deploy --prod --dir="$deployDir"
} else {
  & netlify deploy --prod --dir="$deployDir"
}

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Deploy failed." -ForegroundColor Red
  Write-Host ""
  Write-Host "First time? Run these in this folder:"
  Write-Host "  netlify login"
  Write-Host "  netlify link    (pick postureclinicportal)"
  Write-Host "  .\Deploy-Netlify.ps1"
  Write-Host ""
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Live site:"
Write-Host "  https://postureclinicportal.netlify.app/login.html"
Write-Host "  https://postureclinicportal.netlify.app/patient-intake.html"
Write-Host ""
