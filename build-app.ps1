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

<script src="auth-config.js?v=3"></script>
<script src="auth.js?v=3"></script>
<script>
document.documentElement.style.visibility = "hidden";
PosturePortalAuth.requireAppAccess().then(function (allowed) {
  if (allowed) document.documentElement.style.visibility = "";
});
</script>
'@
  $c = $c -replace '<body>', "<body>$auth"
}

if ($c -notmatch 'portal-logout') {
  $out = @'

<button type="button" class="portal-logout no-print" onclick="PosturePortalAuth.signOut()">Sign out</button>
'@
  $c = $c -replace '</body>', "$out</body>"
}

[IO.File]::WriteAllText($Dst, $c)
Write-Host "Built portal app:" $Dst "($((Get-Item $Dst).Length) bytes)"
