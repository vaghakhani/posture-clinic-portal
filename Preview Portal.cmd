@echo off
setlocal
cd /d "%~dp0"

echo.
echo Posture Clinic Portal - local preview
echo =====================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Restore-BodyChart.ps1"
if errorlevel 1 (
  echo.
  echo Body chart PNG was not auto-installed.
  echo For local testing, open this URL after the server starts:
  echo   http://localhost:8080/install-body-chart.html
  echo Select your clinical chart PNG once, then open app.html
  echo.
) else (
  echo Body chart installed for local preview.
  echo.
)

echo Starting local server...
echo   http://localhost:8080/login.html
echo   http://localhost:8080/app.html?mobilePreview=1
echo.
python -m http.server 8080
