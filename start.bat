@echo off
title AutoScheduler
echo.
echo   AutoScheduler starting...
echo   Browser will open automatically.
echo.
start /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"
npm run dev
pause
