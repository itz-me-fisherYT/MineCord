@echo off
setlocal
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
    echo ❌ Node.js is not installed or not in PATH.
    echo Install Node.js 18+ from: https://nodejs.org/
    pause
    exit /b 1
)

:: Check for npm
npm -v >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not available (PATH issue).
    echo Reinstall Node.js from https://nodejs.org/ and make sure "Add to PATH" is enabled.
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

npm run dev
echo.
echo MineCord has stopped.
pause
