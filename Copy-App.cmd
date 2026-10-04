@echo off
cd /d "%~dp0"
cscript //nologo "%~dp0Sync-App-from-Website.vbs"
if errorlevel 1 exit /b 1
pause
