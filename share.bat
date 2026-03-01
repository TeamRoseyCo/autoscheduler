@echo off
setlocal
title AutoScheduler — Package for Sharing
echo.
echo   ========================================
echo      AutoScheduler — Package for Sharing
echo   ========================================
echo.

set "ZIPNAME=AutoScheduler.zip"

:: Delete old zip if it exists
if exist "%ZIPNAME%" del "%ZIPNAME%"

echo   Creating %ZIPNAME%...
echo   (Excluding node_modules, dev.db, .env.local, .next, dist-electron)
echo.

:: Use PowerShell to create zip with exclusions
powershell -Command ^
    "$source = Get-Location;" ^
    "$exclude = @('node_modules', '.next', 'dist-electron', '.env.local', '.env', 'dev.db', 'dev.db-journal');" ^
    "$files = Get-ChildItem -Path $source -Recurse -Force | Where-Object {" ^
    "    $rel = $_.FullName.Substring($source.Path.Length + 1);" ^
    "    $skip = $false;" ^
    "    foreach ($ex in $exclude) {" ^
    "        if ($rel -like \"$ex*\" -or $rel -like \"$ex\*\") { $skip = $true; break }" ^
    "    };" ^
    "    -not $skip" ^
    "};" ^
    "$tempDir = Join-Path $env:TEMP 'AutoScheduler-package';" ^
    "if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force };" ^
    "New-Item -ItemType Directory -Path $tempDir -Force | Out-Null;" ^
    "foreach ($f in $files) {" ^
    "    $rel = $f.FullName.Substring($source.Path.Length + 1);" ^
    "    $dest = Join-Path $tempDir $rel;" ^
    "    if ($f.PSIsContainer) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }" ^
    "    else { $parent = Split-Path $dest -Parent; if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }; Copy-Item $f.FullName $dest -Force }" ^
    "};" ^
    "Compress-Archive -Path \"$tempDir\*\" -DestinationPath '%ZIPNAME%' -Force;" ^
    "Remove-Item $tempDir -Recurse -Force"

if exist "%ZIPNAME%" (
    echo.
    echo   ========================================
    echo      %ZIPNAME% created successfully!
    echo   ========================================
    echo.
    echo   Send this zip to your friends.
    echo   They just extract it and double-click start.bat
    echo.
    echo   Alternatively, friends can:
    echo     git clone ^<your-repo-url^>
    echo     cd AutoScheduler
    echo     start.bat
    echo.
) else (
    echo.
    echo   ERROR: Failed to create zip.
    echo.
)
pause
