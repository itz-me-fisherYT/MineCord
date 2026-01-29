@echo off
title MineCord - Running

echo ================================
echo        Starting MineCord
echo ================================
echo.

:: Always run from this script's folder (project root)
cd /d "%~dp0"

:: Check for Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed.
    echo Install Node.js 18+ from: https://nodejs.org/
    pause
    exit /b 1
)

:: Run config check first (if present)
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
echo ✅ Starting MineCord...
echo.

:: Start the bot
npm run dev

echo.
echo MineCord has stopped.
pause
