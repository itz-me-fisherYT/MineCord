@echo off
setlocal
title MineCord - Running

cd /d "%~dp0"

echo ================================
echo        Starting MineCord
echo ================================
echo.

npm run dev

echo.
echo MineCord has stopped.
pause
