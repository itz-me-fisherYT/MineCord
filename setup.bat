@echo off
setlocal enabledelayedexpansion
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
    echo.
    pause
    exit /b 1
)

for /f "tokens=* usebackq" %%v in (`node -v`) do set NODEVER=%%v
echo ✅ Node.js detected: %NODEVER%
echo.

:: Install dependencies
echo Installing npm dependencies...
npm install
if errorlevel 1 (
    echo.
    echo ❌ npm install failed.
    echo Try:
    echo   1^) Close any running Node processes
    echo   2^) Delete node_modules and package-lock.json
    echo   3^) Run this again
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ npm dependencies installed.
echo.

:: Create .env if missing (from .env.example if present)
if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo ✅ Created .env from .env.example
    ) else (
        echo ⚠️  .env not found.
        echo     Create a .env file with your DISCORD_TOKEN etc.
    )
) else (
    echo ✅ .env found.
)

:: Check bots.json (optional)
if exist "bots.json" (
    echo ✅ bots.json found (multi-bot mode ready).
) else (
    echo ⚠️  bots.json not found (single-bot mode only unless you add it).
)

echo.
echo --- LAN Info (for phone/other PC) ---
echo Your panel runs on port 3000 by default.
echo Use this IP on other devices:

for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%i
    set IP=!IP: =!
    echo   http://!IP!:3000
)

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Edit .env (Discord token, channel id, MC host/user)
echo 2. (Optional) Create bots.json (for multi-bot mode)
echo 3. Run start.bat
echo.
pause
endlocal
