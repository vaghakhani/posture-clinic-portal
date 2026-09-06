@echo off
setlocal
cd /d "%~dp0"

echo Starting local preview for Posture Clinic Portal...
echo Open http://localhost:8080/login.html
echo.
python -m http.server 8080
pause
