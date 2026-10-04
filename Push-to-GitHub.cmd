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

git add ^
  index.html login.html login.js auth.js auth-config.js sso-callback.html ^
  app.html api-config.js clinic-sync.js ^
  patient-intake.html patient-intake.js patient-intake.css consent-page.js ^
  chiropractic-consent.html osteopathy-consent.html acupuncture-consent.html ^
  portal-theme.css portal-neumorph.css portal-mobile.css portal-calendar.css portal-dark.css portal-pdf.js ^
  Prepare-Netlify-Deploy.ps1 Deploy-Netlify.ps1 Deploy-to-Netlify.cmd ^
  Push-to-GitHub.cmd "Preview Portal.cmd" README.md .gitignore START-NEW-CHAT.md ^
  supabase\schema.sql supabase\fix-intake-rls.sql supabase\fix-intake-fetch.sql supabase\migrate-intake-submissions.sql

if exist Logo.png git add Logo.png
if exist netlify.toml git add netlify.toml

git status
echo.
set /p CONFIRM=Commit and push portal files? [Y/N]:
if /I not "%CONFIRM%"=="Y" (
  echo Cancelled.
  pause
  exit /b 0
)

git commit -m "Update intake forms: Osteopathy, consents, insurance policy holder"
git push -u origin main
echo.
echo Done.
echo Live site is updated by Netlify deploy (Deploy-to-Netlify.cmd), not by this GitHub push alone.
echo Forms:
echo   Chiro: https://postureclinicportal.netlify.app/patient-intake.html
echo   Osteopathy: https://postureclinicportal.netlify.app/patient-intake.html?form=osteopathy
pause
