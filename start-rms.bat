@echo off
cd /d "%~dp0"
title TDCP RMS
echo.
echo Building the latest TDCP design, then starting the app...
echo.
call npm start
pause
