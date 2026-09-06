@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Posture Clinic Portal - Push to GitHub
echo  https://github.com/vaghakhani/posture-clinic-portal
echo ============================================
echo.

if not exist "app.html" (
  echo app.html is missing. Running Copy-App.cmd first...
  call "%~dp0Copy-App.cmd"
  echo.
)

if not exist ".git" (
  echo Initializing git repository...
  git init
  git branch -M main
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/vaghakhani/posture-clinic-portal.git
) else (
  git remote set-url origin https://github.com/vaghakhani/posture-clinic-portal.git
)

git add login.html login.js auth.js auth-config.js sso-callback.html portal-theme.css portal-neumorph.css build-app.ps1 Copy-App.cmd Migrate-Portal.ps1 Push-to-GitHub.cmd "Preview Portal.cmd" README.md .gitignore START-NEW-CHAT.md
if exist app.html git add app.html
if exist Logo.png git add Logo.png

git status
echo.
set /p CONFIRM=Commit and push portal files? [Y/N]:
if /I not "%CONFIRM%"=="Y" (
  echo Cancelled.
  pause
  exit /b 0
)

git commit -m "Add Posture Clinic staff portal with Flowra Clerk login"
git push -u origin main
echo.
echo Done. Portal login: https://vaghakhani.github.io/posture-clinic-portal/login.html
pause
