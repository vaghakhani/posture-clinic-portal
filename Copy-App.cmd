@echo off
setlocal
cd /d "%~dp0"

echo.
echo  Posture Clinic Portal
echo  =====================
echo.

if exist "..\Posture Clinic Website\app.html" (
  echo Migrating app.html from the public website copy...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Migrate-Portal.ps1"
  if errorlevel 1 goto :fail
  goto :done
)

if exist "..\Posture Clinic\PostureClinic.html" (
  echo Building app.html from desktop clinic app...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-app.ps1"
  if errorlevel 1 goto :fail
  goto :done
)

echo Could not find a source app to build.
echo  - Copy app.html manually, or
echo  - Keep Posture Clinic Website next to this folder and run again, or
echo  - Keep Posture Clinic desktop app and run Copy-App.cmd
pause
exit /b 1

:done
echo.
echo SUCCESS: app.html is ready.
echo Open login.html and sign in with your Flowra / Clerk account.
pause
exit /b 0

:fail
echo ERROR: portal build failed.
pause
exit /b 1
