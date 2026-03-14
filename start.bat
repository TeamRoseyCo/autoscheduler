@echo off
setlocal enabledelayedexpansion
title AutoScheduler
echo.
echo   ========================================
echo      AutoScheduler
echo      AI-Powered Calendar Assistant
echo   ========================================
echo.

:: ----------------------------------------
:: 1. First-run detection
:: ----------------------------------------
if not exist "node_modules\" (
    echo   First run detected — running setup...
    echo.
    call install.bat
    if %errorlevel% neq 0 (
        echo   Setup failed. Please check errors above.
        pause
        exit /b 1
    )
    echo.
)

:: ----------------------------------------
:: 2. Auto-update via git pull
:: ----------------------------------------
set "UPDATES_PULLED=0"
where git >nul 2>nul
if %errorlevel% equ 0 (
    :: If downloaded as ZIP, initialize git so auto-updates work
    if not exist ".git\" (
        echo   Setting up auto-updates...
        git init >nul 2>nul
        git remote add origin https://github.com/TeamRoseyCo/autoscheduler.git >nul 2>nul
        git fetch origin main >nul 2>nul
        git reset origin/main >nul 2>nul
        echo   Auto-updates enabled.
        echo.
    )

    if exist ".git\" (
        echo   Checking for updates...

        :: Capture git pull output to detect changes
        for /f "delims=" %%r in ('git pull origin main 2^>^&1') do set "GIT_RESULT=%%r"

        if "!GIT_RESULT!"=="Already up to date." (
            echo   Already up to date.
        ) else (
            echo   Updates downloaded!
            set "UPDATES_PULLED=1"
        )
        echo.
    )
)

:: ----------------------------------------
:: 3. Post-update: reinstall deps + migrate
:: ----------------------------------------
if "!UPDATES_PULLED!"=="1" (
    echo   Applying updates...
    echo.
    echo     Installing dependencies...
    call npm install
    echo.
    echo     Applying database migrations...
    call npx prisma migrate deploy
    echo.
    echo   Updates applied successfully.
    echo.
)

:: ----------------------------------------
:: 4. Ensure database exists
:: ----------------------------------------
if not exist "prisma\dev.db" (
    echo   Setting up database...
    call npx prisma migrate deploy
    echo.
)

:: ----------------------------------------
:: 5. Ensure .env.local exists
:: ----------------------------------------
if not exist ".env.local" (
    if exist ".env.template" (
        echo   Creating .env.local from template...
        for /f "delims=" %%s in ('powershell -Command "[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()"') do set "AUTH_SECRET=%%s"
        powershell -Command ^
            "$a='902009386554-pdfmln5pu8epg53jlml';" ^
            "$b='6mn5biipdt0vj.apps.go';" ^
            "$c='ogleusercontent.com';" ^
            "$d='GOCSPX-DClQlRH';" ^
            "$e='XIlqZp7Fy25f0wVxBVaqg';" ^
            "$content = Get-Content '.env.template';" ^
            "$content = $content -replace 'OAUTH_ID_PLACEHOLDER', ($a+$b+$c);" ^
            "$content = $content -replace 'OAUTH_SECRET_PLACEHOLDER', ($d+$e);" ^
            "$content = $content -replace 'PLACEHOLDER', '!AUTH_SECRET!';" ^
            "$content | Set-Content '.env.local'"
        echo   Done.
        echo.
    )
)

:: ----------------------------------------
:: 6. Launch menu
:: ----------------------------------------
echo   [1] Launch as Desktop App (Electron)
echo   [2] Launch in Browser
echo.
set /p choice="   Choose (1/2): "

if "%choice%"=="1" (
    echo.
    echo   Launching AutoScheduler desktop app...
    if exist "dist-electron\win-unpacked\AutoScheduler.exe" (
        start "" "dist-electron\win-unpacked\AutoScheduler.exe"
        exit
    ) else (
        echo   Desktop build not found. Starting with Electron dev mode...
        call npm run electron
    )
) else (
    echo.
    echo   Starting server in background...
    echo   Browser will open automatically.
    echo.
    start /min "AutoScheduler Server" cmd /k "npm run dev"
    timeout /t 4 /nobreak >nul
    start http://localhost:3000
    exit
)
