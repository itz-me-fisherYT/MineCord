@echo off
title MineCord - Stop

echo ================================
echo        Stopping MineCord
echo ================================
echo.

:: Try to stop nodemon first
for /f "tokens=2 delims=," %%a in ('tasklist /fo csv ^| findstr /i "nodemon.exe"') do (
  echo Found nodemon PID %%~a - stopping...
  taskkill /PID %%~a /F >nul 2>&1
)

:: Then stop node processes (MineCord runs under node)
for /f "tokens=2 delims=," %%a in ('tasklist /fo csv ^| findstr /i "node.exe"') do (
  echo Found node PID %%~a - stopping...
  taskkill /PID %%~a /F >nul 2>&1
)

echo.
echo ✅ Stop command sent.
echo If you had other Node apps running, they may have been stopped too.
echo.
pause
