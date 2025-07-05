@echo off
echo ALEJO Node.js Environment Path Fixer
echo ====================================
echo.

REM Check if Node.js is already in PATH
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Node.js is already in your PATH environment variable.
    node -v
    echo.
    echo npm version:
    npm -v
    goto :end
)

echo Node.js is not in your PATH. Attempting to add it...
echo.

REM Check if Node.js is installed at the expected location
if not exist "C:\Program Files\nodejs\node.exe" (
    echo ERROR: Node.js executable not found at C:\Program Files\nodejs\node.exe
    echo Please install Node.js or verify its installation path.
    goto :end
)

REM Add Node.js to the current session PATH
set "PATH=%PATH%;C:\Program Files\nodejs"
echo Node.js temporarily added to PATH for this session.
echo.

REM Verify Node.js is now accessible
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Node.js is now accessible:
    node -v
    echo.
    echo npm version:
    npm -v
) else (
    echo ERROR: Failed to add Node.js to PATH.
    goto :end
)

echo.
echo To permanently add Node.js to your PATH:
echo 1. Right-click on 'This PC' or 'My Computer' and select 'Properties'
echo 2. Click on 'Advanced system settings'
echo 3. Click on 'Environment Variables'
echo 4. Under 'System variables', find and edit 'Path'
echo 5. Click 'New' and add: C:\Program Files\nodejs
echo 6. Click 'OK' on all dialogs to save changes
echo.
echo Would you like to create a PowerShell script to add Node.js to PATH permanently?
choice /C YN /M "Create permanent fix script"
if %ERRORLEVEL% EQU 1 (
    echo @echo off > fix-nodejs-path-permanent.bat
    echo echo Adding Node.js to system PATH permanently... >> fix-nodejs-path-permanent.bat
    echo powershell -Command "$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';C:\Program Files\nodejs'; [Environment]::SetEnvironmentVariable('Path', $env:Path, 'Machine')" >> fix-nodejs-path-permanent.bat
    echo echo Done! Please restart your command prompt or IDE. >> fix-nodejs-path-permanent.bat
    echo.
    echo Created fix-nodejs-path-permanent.bat
    echo Run this script as Administrator to permanently fix the PATH.
)

:end
echo.
echo ALEJO Environment Check Complete
