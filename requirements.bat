@echo off
title MineCord - Setup

echo ================================
echo   MineCord Setup (One-Time)
echo ================================
echo.

:: Check for Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is NOT installed.
    echo Please install Node.js 18+ from:
    echo https://nodejs.org/
    pause
    exit /b
)

echo ✅ Node.js detected.
echo.

:: Install dependencies
echo Installing npm dependencies...
npm install
if errorlevel 1 (
    echo ❌ npm install failed.
    pause
    exit /b
)

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Configure .env (Discord token)
echo 2. Create bots.json (for multi-bot mode)
echo 3. Run start.bat
echo.
pause
