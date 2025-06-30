@echo off
echo Starting ALEJO...
echo.
echo ===================================
echo A.L.E.J.O. - Defender | Helper | Protector of Mankind
echo ===================================
echo.

:: Run with admin privileges
powershell -Command "Start-Process -FilePath python -ArgumentList 'wake_alejo.py', '--start-now' -Verb RunAs"

echo.
echo If ALEJO doesn't start automatically, please check the logs.
echo.
pause
