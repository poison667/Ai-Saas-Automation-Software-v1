@echo off
title Lumina - AI Social Suite
cd /d "%~dp0"

REM --- 1. Check Python ---
python --version >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Python is not installed or not on PATH.
  echo Install it from https://www.python.org/downloads/
  echo IMPORTANT: tick "Add python.exe to PATH" during install.
  echo.
  pause
  exit /b 1
)

REM --- 2. Install dependencies if missing ---
python -c "import fastapi, uvicorn" >nul 2>nul
if errorlevel 1 (
  echo Installing dependencies (first run only)...
  python -m pip install --quiet fastapi "uvicorn[standard]"
)

REM --- 3. Open the app in your browser shortly ---
echo.
echo  Starting Lumina at http://localhost:8000
echo  Demo login: demo@lumina.social / demo1234
echo  Close this window to stop the server.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"

REM --- 4. Run the server (keeps this window open) ---
python server.py
pause
