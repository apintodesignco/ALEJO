@echo off
echo ===================================================
echo ALEJO Biometrics Test Suite
echo ===================================================
echo.

REM Parse command line arguments
set ARGS=

:parse
if "%~1"=="" goto :execute
set ARGS=%ARGS% %1
shift
goto :parse

:execute
echo Running comprehensive biometrics tests including:
echo  - Eye tracking unit and integration tests
echo  - Face detection tests
echo  - Hand tracking tests
echo  - Core biometrics system tests
echo  - Security scanning
echo  - Performance benchmarking
echo.
echo Command line arguments: %ARGS%
echo.

npx node tests/run_biometrics_tests.js%ARGS%

if %ERRORLEVEL% EQU 0 (
  echo.
  echo ===================================================
  echo All biometrics tests passed successfully!
  echo ===================================================
) else (
  echo.
  echo ===================================================
  echo Some tests failed. See report for details.
  echo ===================================================
  exit /b %ERRORLEVEL%
)
