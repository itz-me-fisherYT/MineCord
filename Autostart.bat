@echo off
title MineCord - Auto Restart
cd /d "%~dp0"

echo ================================
echo   MineCord AutoStart (Laptop)
echo ================================
echo.
echo This mode will automatically restart MineCord if it stops.
echo Close this window to fully stop MineCord.
echo.

:START
echo [%DATE% %TIME%] Starting MineCord...
echo.

npm run dev

echo.
echo [%DATE% %TIME%] MineCord stopped.
echo Restarting in 10 seconds...
echo Press CTRL+C to cancel.
echo.

timeout /t 10 /nobreak >nul
goto START
