@echo off
setlocal
title Lumina - AI Social Suite
cd /d "%~dp0"

echo.
echo  ================================================
echo    Lumina launcher (Windows)
echo    Folder: %cd%
echo  ================================================
echo.

REM ---------- 1. Find Python ----------
set "PYCMD="
where python >nul 2>nul
if %errorlevel%==0 set "PYCMD=python"
if defined PYCMD goto :found_python
where py >nul 2>nul
if %errorlevel%==0 set "PYCMD=py -3"
if defined PYCMD goto :found_python

echo [ERROR] Python was not found on this PC.
echo.
echo   1. Download Python:  https://www.python.org/downloads/
echo   2. In the installer TICK "Add python.exe to PATH"
echo   3. After installing, double-click run.bat again.
echo.
pause
exit /b 1

:found_python
echo [1/3] Python found: %PYCMD%
%PYCMD% --version
echo.

REM ---------- 2. Install dependencies if missing ----------
%PYCMD% -c "import fastapi, uvicorn" >nul 2>nul
if %errorlevel%==0 goto :deps_ok
echo [2/3] Installing dependencies (first run only)...
%PYCMD% -m pip install --quiet fastapi "uvicorn[standard]"
if %errorlevel%==0 goto :deps_ok
echo.
echo [ERROR] Installing dependencies failed. Read the messages above.
pause
exit /b 1

:deps_ok
echo [2/3] Dependencies ready.

REM ---------- 3. Start server + open browser ----------
echo [3/3] Starting Lumina...
echo.
echo   Address : http://localhost:8000
echo   Login   : demo@lumina.social / demo1234
echo   Stop by closing this window.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"
%PYCMD% server.py

echo.
echo  The server stopped. If it quit instantly, the error message is above.
pause
exit /b 0
