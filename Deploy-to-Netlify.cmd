@echo off
setlocal
cd /d "%~dp0"
echo.
echo Installing body chart, then deploying to Netlify...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Restore-BodyChart.ps1"
if errorlevel 1 (
  echo.
  echo Body chart install failed. Save your clinical chart PNG as:
  echo   body-chart-source.png
  echo in this folder, then run this script again.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Deploy-Netlify.ps1"
pause
