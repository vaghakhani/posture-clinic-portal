param(
  [string]$WebsiteApp = "",
  [string]$Dst = ""
)

if (-not $Dst) { $Dst = Join-Path $PSScriptRoot "app.html" }
if (-not $WebsiteApp) {
  $WebsiteApp = Join-Path $PSScriptRoot "..\Posture Clinic Website\app.html"
}

if (-not (Test-Path $WebsiteApp)) {
  Write-Error "Source app.html not found: $WebsiteApp"
  exit 1
}

Copy-Item -Path $WebsiteApp -Destination $Dst -Force
$c = [IO.File]::ReadAllText($Dst)

$newAuth = @'
<script src="auth-config.js?v=2"></script>
<script src="auth.js?v=2"></script>
<script>
document.documentElement.style.visibility = "hidden";
PosturePortalAuth.requireAppAccess().then(function (allowed) {
  if (allowed) document.documentElement.style.visibility = "";
});
</script>

'@

$oldAuth = '(?s)<script>\s*\(function\(\)\{\s*const AUTH_KEY = "postureclinic_admin_auth";.*?</script>\s*'
if ($c -match 'postureclinic_admin_auth' -and $c -notmatch 'PosturePortalAuth\.requireAppAccess') {
  $c = [regex]::Replace($c, $oldAuth, $newAuth, 1)
} elseif ($c -notmatch 'PosturePortalAuth\.requireAppAccess') {
  $c = [regex]::Replace($c, '<body>', "<body>`r`n$newAuth", 1)
}

if ($c -notmatch 'name="robots"') {
  $c = [regex]::Replace($c, '(?i)<meta charset="UTF-8"\s*/>', "<meta charset=`"UTF-8`" />`r`n<meta name=`"robots`" content=`"noindex, nofollow`" />", 1)
}

$c = $c -replace "location\.replace\(""portal\.html""\);", "location.replace('login.html');"
$c = [regex]::Replace(
  $c,
  '<button type="button" class="portal-logout no-print" onclick="[^"]*">Sign out</button>',
  '<button type="button" class="portal-logout no-print" onclick="PosturePortalAuth.signOut()">Sign out</button>'
)
$c = $c -replace "location\.href='portal\.html'", "PosturePortalAuth.signOut()"

$c = [regex]::Replace(
  $c,
  '(?s)\s*<div class="sec-title">Admin Password</div>\s*<p class="desc">Change the password used to sign in at <code>portal\.html</code>\. Stored locally in this browser only\.</p>\s*<div class="grid three" style="align-items:end">.*?</div>\s*(<div style="margin-top:12px"><button class="btn" onclick="changeAdminPass\(\)">Change Admin Password</button></div>\s*)?',
  "`r`n    "
)

$c = [regex]::Replace(
  $c,
  '(?s)const ADMIN_PASS_KEY = "postureclinic_admin_pass";\s*const DEFAULT_ADMIN_PASS = "Posture8118";\s*function getAdminPass\(\)\{[^}]*\}\s*function changeAdminPass\(\)\{.*?toast\("Admin password updated"\);\s*\}\s*',
  ''
)

# Repair a previous partial migrate that left the changeAdminPass body behind
$c = [regex]::Replace(
  $c,
  '(?s)\r?\nif\(!nw \|\| nw\.length<6\)\{ toast\("New password must be at least 6 characters"\); return; \}.*?toast\("Admin password updated"\);\s*\}\s*',
  "`r`n"
)

[IO.File]::WriteAllText($Dst, $c)

if ($c -match 'Posture8118' -or $c -match 'postureclinic_admin_auth' -or $c -match 'changeAdminPass' -or $c -match 'ADMIN_PASS_KEY') {
  Write-Error "Migration left leftover password auth in app.html"
  exit 1
}

Write-Host "Migrated portal app:" $Dst
