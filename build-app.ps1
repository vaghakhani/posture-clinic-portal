param(
  [string]$Src,
  [string]$Dst
)

if (-not $Dst) { $Dst = Join-Path $PSScriptRoot "app.html" }
if (-not $Src) {
  $Src = Join-Path $PSScriptRoot "..\Posture Clinic\PostureClinic.html"
}

if (-not (Test-Path $Src)) {
  Write-Error "Source not found: $Src"
  exit 1
}

Copy-Item -Path $Src -Destination $Dst -Force
$c = [IO.File]::ReadAllText($Dst)

if ($c -notmatch 'portal-neumorph\.css') {
  $c = $c -replace '</style>\s*</head>', "</style>`r`n<link rel=`"stylesheet`" href=`"portal-neumorph.css`" />`r`n</head>"
}

if ($c -notmatch 'PosturePortalAuth\.requireAppAccess') {
  $auth = @'

<script src="auth-config.js?v=5"></script>
<script src="auth.js?v=5"></script>
<script src="api-config.js?v=1"></script>
<script src="clinic-sync.js?v=1"></script>
<script>document.documentElement.style.visibility = "hidden";</script>
'@
  $c = $c -replace '<body>', "<body>$auth"
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

if ($c -notmatch 'portal-logout') {
  $out = @'

<button type="button" class="portal-logout no-print" onclick="PosturePortalAuth.signOut()">Sign out</button>
'@
  $c = $c -replace '</body>', "$out</body>"
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

[IO.File]::WriteAllText($Dst, $c)
Write-Host "Built portal app:" $Dst "($((Get-Item $Dst).Length) bytes)"
