@echo off
cd /d "%~dp0"
echo Syncing FROM Portal app.html (source of truth) to netlify-deploy and Website...
cscript //nologo "%~dp0Sync-App-from-Website.vbs"
if errorlevel 1 exit /b 1
echo.
echo Next: double-click Deploy-to-Netlify.cmd to publish.
pause
