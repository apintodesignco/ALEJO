@echo off
REM ALEJO with Gesture System Startup Script
REM Batch file to start ALEJO with gesture support

echo ==========================================================
echo   ALEJO SYSTEM WITH GESTURE SUPPORT
echo ==========================================================

REM Parse command line arguments
set MODE=docker
set WEB_PORT=8000
set WS_PORT=8765
set ACCESSIBILITY=enhanced
set NO_GESTURE=
set NO_BROWSER=
set VALIDATE=

:parse_args
if "%~1"=="" goto :end_parse_args
if /i "%~1"=="--local" (
    set MODE=local
    shift
    goto :parse_args
)
if /i "%~1"=="--docker" (
    set MODE=docker
    shift
    goto :parse_args
)
if /i "%~1"=="--web-port" (
    set WEB_PORT=%~2
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--ws-port" (
    set WS_PORT=%~2
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--accessibility" (
    set ACCESSIBILITY=%~2
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--no-gesture" (
    set NO_GESTURE=--no-gesture
    shift
    goto :parse_args
)
if /i "%~1"=="--no-browser" (
    set NO_BROWSER=--no-browser
    shift
    goto :parse_args
)
if /i "%~1"=="--validate" (
    set VALIDATE=--validate
    shift
    goto :parse_args
)
shift
goto :parse_args
:end_parse_args

REM Check if Python is installed
python --version > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.9+ and try again.
    exit /b 1
)

REM Check if Docker is installed (if using docker mode)
if "%MODE%"=="docker" (
    docker --version > nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Docker not found. Please install Docker Desktop and try again.
        echo         Alternatively, use --local to run without Docker.
        exit /b 1
    )
    
    docker-compose --version > nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Docker Compose not found. Please install Docker Desktop and try again.
        exit /b 1
    )
)

REM Display configuration
echo.
echo Configuration:
echo   Mode: %MODE%
echo   Web Port: %WEB_PORT%
echo   WebSocket Port: %WS_PORT%
if "%NO_GESTURE%"=="" (
    echo   Gesture System: Enabled
    echo   Accessibility Level: %ACCESSIBILITY%
) else (
    echo   Gesture System: Disabled
)
if "%NO_BROWSER%"=="" (
    echo   Open Browser: Yes
) else (
    echo   Open Browser: No
)
if "%VALIDATE%"=="" (
    echo   Validate Deployment: No
) else (
    echo   Validate Deployment: Yes
)
echo.

REM Start the system
echo Starting ALEJO with gesture support...
echo Press Ctrl+C to stop.
echo.

REM Build the command
set CMD=python start_alejo_with_gestures.py --mode %MODE% --web-port %WEB_PORT% --ws-port %WS_PORT% --accessibility %ACCESSIBILITY% %NO_GESTURE% %NO_BROWSER% %VALIDATE%

REM Execute the Python script
%CMD%

REM Display access information
echo.
echo ==========================================================
echo   ALEJO SYSTEM ACCESS
echo ==========================================================
echo   Web Interface:     http://localhost:%WEB_PORT%
if "%NO_GESTURE%"=="" (
    echo   Gesture Interface: http://localhost:%WEB_PORT%/gestures
    echo   WebSocket Server:  ws://localhost:%WS_PORT%
)
echo ==========================================================
