@echo off
setlocal enabledelayedexpansion
title AutoScheduler — First-Time Setup
echo.
echo   ========================================
echo      AutoScheduler — First-Time Setup
echo   ========================================
echo.

:: ----------------------------------------
:: 1. Check / Install Node.js
:: ----------------------------------------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   [1/5] Node.js not found. Installing...
    echo.

    :: Download Node.js LTS installer
    set "NODE_URL=https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi"
    set "NODE_MSI=%TEMP%\nodejs-install.msi"

    echo         Downloading Node.js LTS...
    powershell -Command "Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_MSI!'" 2>nul
    if not exist "!NODE_MSI!" (
        echo.
        echo   ERROR: Failed to download Node.js.
        echo   Please install Node.js manually from https://nodejs.org
        echo.
        pause
        exit /b 1
    )

    echo         Installing Node.js (this may take a minute^)...
    msiexec /i "!NODE_MSI!" /quiet /norestart
    if %errorlevel% neq 0 (
        echo.
        echo   ERROR: Node.js installation failed.
        echo   Please install Node.js manually from https://nodejs.org
        echo.
        pause
        exit /b 1
    )

    :: Refresh PATH so node/npm are available in this session
    set "PATH=%ProgramFiles%\nodejs;%PATH%"

    del "!NODE_MSI!" >nul 2>nul
    echo         Node.js installed successfully.
    echo.
) else (
    echo   [1/5] Node.js found.
)

:: ----------------------------------------
:: 2. Check / Install Git
:: ----------------------------------------
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo   [2/5] Git not found. Installing...
    echo.

    set "GIT_URL=https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe"
    set "GIT_EXE=%TEMP%\git-install.exe"

    echo         Downloading Git...
    powershell -Command "Invoke-WebRequest -Uri '!GIT_URL!' -OutFile '!GIT_EXE!'" 2>nul
    if not exist "!GIT_EXE!" (
        echo.
        echo   WARNING: Failed to download Git.
        echo   Auto-updates won't work without Git.
        echo   You can install Git manually from https://git-scm.com
        echo.
    ) else (
        echo         Installing Git (this may take a minute^)...
        "!GIT_EXE!" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"
        if %errorlevel% neq 0 (
            echo.
            echo   WARNING: Git installation failed.
            echo   Auto-updates won't work without Git.
            echo.
        ) else (
            :: Refresh PATH for Git
            set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
            echo         Git installed successfully.
        )
        del "!GIT_EXE!" >nul 2>nul
    )
    echo.
) else (
    echo   [2/5] Git found.
)

:: ----------------------------------------
:: 3. Set up .env.local from template
:: ----------------------------------------
if not exist ".env.local" (
    if exist ".env.template" (
        echo   [3/5] Creating .env.local from template...
        echo.
        echo         You need Google OAuth credentials to sign in.
        echo         Ask whoever shared this app for the Client ID and Secret.
        echo.
        set /p "OAUTH_ID=         Google Client ID: "
        set /p "OAUTH_SECRET=         Google Client Secret: "
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

        echo         .env.local created with unique AUTH_SECRET.
    ) else (
        echo   [3/5] WARNING: No .env.template found. You'll need to create .env.local manually.
    )
) else (
    echo   [3/5] .env.local already exists.
)

:: ----------------------------------------
:: 4. Install npm dependencies
:: ----------------------------------------
echo   [4/5] Installing dependencies (npm install^)...
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo   ERROR: npm install failed.
    pause
    exit /b 1
)
echo.

:: ----------------------------------------
:: 5. Set up database
:: ----------------------------------------
echo   [5/5] Setting up database...
echo.
call npx prisma generate
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo.
    echo   ERROR: Database setup failed.
    pause
    exit /b 1
)
echo.

echo   ========================================
echo      Setup complete!
echo      Run start.bat to launch the app.
echo   ========================================
echo.
pause
