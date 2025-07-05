@echo off
echo ===================================================
echo ALEJO Eye Tracking Test Suite
echo ===================================================
echo.

echo Running unit tests for eye tracking...
npm test -- --grep "Eye Tracking Unit Tests"

echo.
echo Running integration tests for eye tracking...
npm test -- --grep "Eye Tracking Integration Tests"

echo.
echo Running calibration tests for eye tracking...
npm test -- --grep "Eye Tracking Calibration Integration Tests"

echo.
echo Running system tests for eye tracking...
npm test -- --grep "Eye Tracking System Tests"

echo.
echo ===================================================
echo Test execution complete
echo ===================================================
