@echo off
setlocal
title MineCord - Running

echo ================================
echo        Starting MineCord
echo ================================
echo.

cd /d "%~dp0"

node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH.
    echo Install Node.js 18+ from: https://nodejs.org/
    pause
    exit /b 1
)

npm -v >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not available (PATH issue).
    echo Reinstall Node.js from https://nodejs.org/ and make sure "Add to PATH" is enabled.
    pause
    exit /b 1
)

if exist "check-config.bat" (
    call check-config.bat
    if errorlevel 1 (
        echo.
        echo ❌ Fix the config issues above, then run start.bat again.
        pause
        exit /b 1
    )
) else (
    echo ⚠️ check-config.bat not found - skipping config validation.
)

echo.
echo ✅ Starting MineCord in a new window...
echo.

start "MineCord" cmd /k "npm run dev"
exit /b 0
