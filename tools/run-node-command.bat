@echo off
REM ALEJO Node.js Command Runner
REM This script finds Node.js on the system and runs the specified command
REM Usage: run-node-command.bat [command] [args...]
REM Example: run-node-command.bat node tools/setup-environment.js

setlocal enabledelayedexpansion

echo ALEJO Node.js Command Runner
echo ===========================

REM Check if Node.js is in PATH
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Node.js found in PATH
    goto :RUN_COMMAND
)

REM Try common installation locations
set NODE_LOCATIONS=^
    "C:\Program Files\nodejs\node.exe"^
    "C:\Program Files (x86)\nodejs\node.exe"^
    "%APPDATA%\npm\node.exe"^
    "%ProgramFiles%\nodejs\node.exe"^
    "%ProgramFiles(x86)%\nodejs\node.exe"^
    "%USERPROFILE%\AppData\Roaming\nvm\current\node.exe"

for %%i in (%NODE_LOCATIONS%) do (
    if exist %%i (
        echo Found Node.js at: %%i
        set "NODE_PATH=%%~dpi"
        goto :FOUND_NODE
    )
)

REM If we get here, Node.js was not found
echo ERROR: Node.js not found on this system.
echo Please install Node.js from https://nodejs.org/
echo After installation, run tools/add-nodejs-to-path.ps1 as Administrator
echo to permanently add Node.js to your system PATH.
exit /b 1

:FOUND_NODE
REM Add Node.js to PATH temporarily for this session
echo Adding Node.js to PATH temporarily
set "PATH=%NODE_PATH%;%PATH%"

:RUN_COMMAND
REM Check if a command was provided
if "%~1"=="" (
    echo ERROR: No command specified
    echo Usage: run-node-command.bat [command] [args...]
    echo Example: run-node-command.bat node tools/setup-environment.js
    exit /b 1
)

REM Run the specified command
echo Running command: %*
%*

REM Check if the command succeeded
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Command failed with exit code %ERRORLEVEL%
    echo.
    echo For a permanent fix to Node.js PATH issues:
    echo 1. Right-click on PowerShell and select "Run as Administrator"
    echo 2. Navigate to the ALEJO project directory
    echo 3. Run: .\tools\add-nodejs-to-path.ps1
    exit /b %ERRORLEVEL%
) else (
    echo.
    echo Command completed successfully
)

endlocal
exit /b 0
