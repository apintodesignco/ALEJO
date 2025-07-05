@echo off
echo ===================================================
echo ALEJO Eye Tracking Demo
echo ===================================================
echo.
echo Please select which demo to run:
echo 1. Basic Eye Tracking Demo
echo 2. Eye Tracking Calibration Demo
echo.

set /p choice="Enter your choice (1 or 2): "

if "%choice%"=="1" (
  echo.
  echo Starting the basic eye tracking demo server...
  echo.
  node demos/server.js
) else if "%choice%"=="2" (
  echo.
  echo Starting the eye tracking calibration demo server...
  echo.
  node demos/eye-tracking-calibration-demo/server.js
) else (
  echo.
  echo Invalid choice. Please run the script again and select 1 or 2.
  exit /b 1
)
