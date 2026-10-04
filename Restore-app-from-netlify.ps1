$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root "netlify-deploy\app.html"
$dst = Join-Path $root "app.html"
if (-not (Test-Path -LiteralPath $src)) {
  Write-Error "Source not found: $src"
  exit 1
}
Copy-Item -LiteralPath $src -Destination $dst -Force
$f = Get-Item -LiteralPath $dst
Write-Host "Restored: $($f.FullName)"
Write-Host "Size: $($f.Length) bytes"
