@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul
title AutoScheduler Setup Wizard
color 0F
cls

echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║                                                      ║
echo   ║         Welcome to AutoScheduler Setup!              ║
echo   ║         ───────────────────────────────              ║
echo   ║                                                      ║
echo   ║   This wizard will get everything ready for you.     ║
echo   ║   Just sit back — it handles everything!             ║
echo   ║                                                      ║
echo   ║   What it will do:                                   ║
echo   ║     1. Install Node.js  (if you don't have it)       ║
echo   ║     2. Install Git      (for auto-updates)           ║
echo   ║     3. Download app dependencies                     ║
echo   ║     4. Set up the database                           ║
echo   ║     5. Create a desktop shortcut                     ║
echo   ║                                                      ║
echo   ║   This may take 2-5 minutes on the first run.        ║
echo   ║                                                      ║
echo   ╚══════════════════════════════════════════════════════╝
echo.
echo   Press any key to start...
pause >nul

cls
echo.
echo   AutoScheduler Setup
echo   ════════════════════
echo.

:: ========================================
:: STEP 1: Node.js
:: ========================================
echo   ┌────────────────────────────────────┐
echo   │  Step 1 of 5 — Checking Node.js   │
echo   └────────────────────────────────────┘
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo     Node.js is not installed.
    echo     Downloading Node.js — this may take a minute...
    echo.

    set "NODE_URL=https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi"
    set "NODE_MSI=%TEMP%\nodejs-install.msi"

    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_MSI!'" 2>nul
    if not exist "!NODE_MSI!" (
        color 0C
        echo     ERROR: Could not download Node.js.
        echo.
        echo     Please install it manually:
        echo       1. Go to https://nodejs.org
        echo       2. Click the big green "Download" button
        echo       3. Run the installer
        echo       4. Then run this setup again
        echo.
        pause
        exit /b 1
    )

    echo     Installing Node.js (a window may flash — that's normal^)...
    echo.
    msiexec /i "!NODE_MSI!" /quiet /norestart
    if %errorlevel% neq 0 (
        color 0C
        echo     ERROR: Node.js installer failed.
        echo     Please install it manually from https://nodejs.org
        echo.
        pause
        exit /b 1
    )

    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    del "!NODE_MSI!" >nul 2>nul
    echo     Done! Node.js installed.
) else (
    for /f "delims=" %%v in ('node --version') do echo     Found Node.js %%v
)
echo.

:: ========================================
:: STEP 2: Git
:: ========================================
echo   ┌────────────────────────────────────┐
echo   │  Step 2 of 5 — Checking Git       │
echo   └────────────────────────────────────┘
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo     Git is not installed.
    echo     Downloading Git — this may take a minute...
    echo.

    set "GIT_URL=https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe"
    set "GIT_EXE=%TEMP%\git-install.exe"

    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!GIT_URL!' -OutFile '!GIT_EXE!'" 2>nul
    if not exist "!GIT_EXE!" (
        echo     WARNING: Could not download Git.
        echo     The app will still work, but won't auto-update.
        echo     You can install Git later from https://git-scm.com
        echo.
    ) else (
        echo     Installing Git (a window may flash — that's normal^)...
        echo.
        "!GIT_EXE!" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"
        if %errorlevel% neq 0 (
            echo     WARNING: Git installer had an issue.
            echo     The app will still work, but won't auto-update.
            echo.
        ) else (
            set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
            echo     Done! Git installed.
        )
        del "!GIT_EXE!" >nul 2>nul
    )
) else (
    for /f "delims=" %%v in ('git --version') do echo     Found %%v
)
echo.

:: ========================================
:: STEP 3: Environment config
:: ========================================
echo   ┌────────────────────────────────────┐
echo   │  Step 3 of 5 — Configuring app    │
echo   └────────────────────────────────────┘
echo.

if not exist ".env.local" (
    if exist ".env.template" (
        echo     Setting up configuration...
        echo.
        echo     You need Google OAuth credentials to sign in.
        echo     Ask whoever shared this app for the Client ID and Secret.
        echo.
        set /p "OAUTH_ID=     Google Client ID: "
        set /p "OAUTH_SECRET=     Google Client Secret: "
        echo.

        :: Generate a random AUTH_SECRET
        for /f "delims=" %%s in ('powershell -Command "[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()"') do set "AUTH_SECRET=%%s"

        :: Build .env.local with real values
        powershell -Command ^
            "$content = Get-Content '.env.template';" ^
            "$content = $content -replace 'your-google-client-id-here', '!OAUTH_ID!';" ^
            "$content = $content -replace 'your-google-client-secret-here', '!OAUTH_SECRET!';" ^
            "$content = $content -replace 'PLACEHOLDER', '!AUTH_SECRET!';" ^
            "$content | Set-Content '.env.local'"

        echo     Done! Configuration created.
    ) else (
        color 0E
        echo     WARNING: No .env.template found.
        echo     Ask the person who shared this app for the .env.template file.
        echo.
        pause
        exit /b 1
    )
) else (
    echo     Configuration already set up.
)
echo.

:: ========================================
:: STEP 4: Dependencies + Database
:: ========================================
echo   ┌────────────────────────────────────┐
echo   │  Step 4 of 5 — Installing app     │
echo   └────────────────────────────────────┘
echo.
echo     Downloading dependencies (this is the longest step^)...
echo     Please wait...
echo.

call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo     ERROR: Failed to install dependencies.
    echo     Try closing this window and running SETUP.bat again.
    echo.
    pause
    exit /b 1
)

echo.
echo     Setting up database...
echo.
call npx prisma generate
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo     ERROR: Database setup failed.
    echo     Try closing this window and running SETUP.bat again.
    echo.
    pause
    exit /b 1
)
echo.
echo     Done!
echo.

:: ========================================
:: STEP 5: Desktop Shortcut
:: ========================================
echo   ┌────────────────────────────────────┐
echo   │  Step 5 of 5 — Desktop shortcut   │
echo   └────────────────────────────────────┘
echo.
echo     Creating a "Start AutoScheduler" shortcut on your Desktop...

:: Create a shortcut that runs start.bat
set "DESKTOP=%USERPROFILE%\Desktop"
set "APPDIR=%~dp0"

powershell -Command ^
    "$ws = New-Object -ComObject WScript.Shell;" ^
    "$s = $ws.CreateShortcut('%DESKTOP%\Start AutoScheduler.lnk');" ^
    "$s.TargetPath = '%APPDIR%start.bat';" ^
    "$s.WorkingDirectory = '%APPDIR%';" ^
    "$s.IconLocation = '%APPDIR%public\icon.ico';" ^
    "$s.Description = 'Launch AutoScheduler';" ^
    "$s.Save()"

if exist "%DESKTOP%\Start AutoScheduler.lnk" (
    echo     Done! You'll see "Start AutoScheduler" on your Desktop.
) else (
    echo     Could not create shortcut (that's OK — you can use start.bat directly^).
)
echo.

:: ========================================
:: DONE!
:: ========================================
cls
color 0A
echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║                                                      ║
echo   ║            Setup Complete!                           ║
echo   ║                                                      ║
echo   ╠══════════════════════════════════════════════════════╣
echo   ║                                                      ║
echo   ║   How to use AutoScheduler:                          ║
echo   ║                                                      ║
echo   ║   1. Double-click "Start AutoScheduler"              ║
echo   ║      on your Desktop (or run start.bat)              ║
echo   ║                                                      ║
echo   ║   2. Choose "Launch in Browser" (option 2)           ║
echo   ║                                                      ║
echo   ║   3. Sign in with your Google account                ║
echo   ║                                                      ║
echo   ║   4. Go to Settings and enter your AI API key        ║
echo   ║      (ask whoever shared this app if unsure)         ║
echo   ║                                                      ║
echo   ║   That's it! The app auto-updates every time         ║
echo   ║   you launch it.                                     ║
echo   ║                                                      ║
echo   ╚══════════════════════════════════════════════════════╝
echo.
echo.

set /p launch="   Launch AutoScheduler now? (Y/N): "
if /i "%launch%"=="Y" (
    call start.bat
) else (
    echo.
    echo   OK! Just double-click "Start AutoScheduler" on your
    echo   Desktop whenever you're ready.
    echo.
    pause
)
