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
<script src="auth-config.js?v=5"></script>
<script src="auth.js?v=5"></script>
<script src="api-config.js?v=1"></script>
<script src="clinic-sync.js?v=1"></script>
<script>document.documentElement.style.visibility = "hidden";</script>

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

if ($c -notmatch 'portal-brand-logo') {
  $c = [regex]::Replace(
    $c,
    '(?s)<div class="brand">\s*<h1>Posture Clinic</h1>\s*<p>Dr\. Ardeshir Ekhtiari, DC</p>\s*</div>',
    "<div class=`"brand`">`r`n      <img class=`"portal-brand-logo`" src=`"Logo.png`" alt=`"Posture Clinic`" width=`"160`" height=`"160`" />`r`n    </div>",
    1
  )
}

if ($c -notmatch 'rel="icon"') {
  $c = [regex]::Replace($c, '<title>Posture Clinic', '<link rel="icon" href="Logo.png" type="image/png" />`r`n<title>Posture Clinic', 1)
}

$sbFoot = @'
    <div class="sb-foot">
      <p class="sb-foot-copy">Clinic data is saved securely online.</p>
      <button type="button" class="portal-logout no-print" onclick="PosturePortalAuth.signOut()">Sign out</button>
    </div>
'@

if ($c -notmatch 'sb-foot-copy') {
  $c = [regex]::Replace(
    $c,
    '<div class="sb-foot">Local &amp; private — data stays on this PC\.</div>',
    $sbFoot,
    1
  )
}

$c = [regex]::Replace(
  $c,
  '\s*<button type="button" class="portal-logout no-print" onclick="PosturePortalAuth\.signOut\(\)">Sign out</button>\s*</body>',
  '</body>',
  1
)

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

# Clean up partial migrations that left password field fragments behind
$c = [regex]::Replace(
  $c,
  '(?s)\s*<div class="field"><label>Current Password</label><input id="admin_cur"[^>]*/></div>\s*<div class="field"><label>New Password</label><input id="admin_new"[^>]*/></div>\s*<div class="field"><label>Confirm New Password</label><input id="admin_confirm"[^>]*/></div>\s*</div>\s*<div style="margin-top:12px"><button class="btn" onclick="changeAdminPass\(\)">Change Admin Password</button></div>\s*',
  "`r`n    "
)
$c = [regex]::Replace(
  $c,
  '(?s)\s*<div class="field"><label>New Password</label><input id="admin_new"[^>]*/></div>\s*<div class="field"><label>Confirm New Password</label><input id="admin_confirm"[^>]*/></div>\s*</div>\s*<div style="margin-top:12px"><button class="btn" onclick="changeAdminPass\(\)">Change Admin Password</button></div>\s*',
  "`r`n    "
)
$c = $c -replace '<div style="margin-top:12px"><button class="btn" onclick="changeAdminPass\(\)">Change Admin Password</button></div>\s*', ''

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

if ($c -notmatch 'clinic-sync\.js') {
  $c = [regex]::Replace(
    $c,
    '<script src="auth\.js\?v=\d+"></script>',
    '<script src="auth.js?v=5"></script>`r`n<script src="api-config.js?v=1"></script>`r`n<script src="clinic-sync.js?v=1"></script>',
    1
  )
}

if ($c -notmatch 'bootPortal') {
  $c = [regex]::Replace(
    $c,
    '(?s)/\* ============================ INIT ============================ \*/\s*initStorage\(\);',
    @'
/* ============================ INIT ============================ */
(async function bootPortal(){
  const allowed = await PosturePortalAuth.requireAppAccess();
  if(!allowed) return;
  await initStorage();
  document.documentElement.style.visibility = "";
})();
'@,
    1
  )
}

$c = $c -replace 'Local &amp; private — data stays on this PC\.', 'Clinic data is saved securely online.'
$c = $c -replace 'onclick="storageBadgeClick\(\)">Local only', '>Cloud synced'
$c = $c -replace 'Fully offline — no internet or accounts needed\.', ''
$c = $c -replace 'This offline app cannot write directly into your Google account\. The button downloads a Google Sheets-compatible Excel file, then opens Google Sheets\. ', 'Downloads a Google Sheets-compatible Excel file, then opens Google Sheets. '

[IO.File]::WriteAllText($Dst, $c)

if ($c -match 'Posture8118' -or $c -match 'postureclinic_admin_auth' -or $c -match 'changeAdminPass' -or $c -match 'ADMIN_PASS_KEY') {
  Write-Error "Migration left leftover password auth in app.html"
  exit 1
}

Write-Host "Migrated portal app:" $Dst
