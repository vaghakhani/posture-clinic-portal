$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$deploy = Join-Path $root "netlify-deploy"

$sourceCandidates = @(
  (Join-Path $root "body-chart-source.png"),
  (Join-Path $root "assets\body-chart.png"),
  "$env:USERPROFILE\.cursor\projects\d-Cursor\assets\c__Users_vagha_AppData_Roaming_Cursor_User_workspaceStorage_58e34e9610e7aa9d59d216923b20fe2c_images_image-e598e244-e774-46a4-90dc-341a462c7a92.png",
  "$env:USERPROFILE\.cursor\projects\d-Cursor\assets\c__Users_vagha_AppData_Roaming_Cursor_User_workspaceStorage_58e34e9610e7aa9d59d216923b20fe2c_images_image-d00c1949-5eec-4de2-9f73-ff85c4aa6338.png",
  "$env:USERPROFILE\.cursor\projects\d-Cursor\assets\c__Users_vagha_AppData_Roaming_Cursor_User_workspaceStorage_58e34e9610e7aa9d59d216923b20fe2c_images_image-a7ae1b65-df9c-4d90-8eb4-67a06b1fe8f6.png"
)

$src = $sourceCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $src) {
  Write-Host "Clinical body chart PNG not found." -ForegroundColor Red
  Write-Host ""
  Write-Host "Save the front/back clinical chart image as:"
  Write-Host "  $root\body-chart-source.png"
  Write-Host ""
  Write-Host "Or upload it in the portal: Settings > Branding > Upload Body Chart"
  exit 1
}

$dest = Join-Path $root "body-chart.png"
Copy-Item -LiteralPath $src -Destination $dest -Force
$bytes = [IO.File]::ReadAllBytes($dest)
$b64 = [Convert]::ToBase64String($bytes)
$embedJs = "window.POSTURE_DEFAULT_BODY_CHART='data:image/png;base64,$b64';"
$embedPath = Join-Path $root "body-chart.embed.js"
[IO.File]::WriteAllText($embedPath, $embedJs)
Write-Host "Installed clinical body chart:"
Write-Host "  $dest"
Write-Host "  $((Get-Item -LiteralPath $dest).Length) bytes"
Write-Host "  $embedPath"
Write-Host "  $((Get-Item -LiteralPath $embedPath).Length) bytes"

if (Test-Path $deploy) {
  Copy-Item -LiteralPath $dest -Destination (Join-Path $deploy "body-chart.png") -Force
  Copy-Item -LiteralPath $embedPath -Destination (Join-Path $deploy "body-chart.embed.js") -Force
  Write-Host "  $(Join-Path $deploy 'body-chart.png')"
  Write-Host "  $(Join-Path $deploy 'body-chart.embed.js')"
}
