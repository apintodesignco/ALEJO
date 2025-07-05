@echo off
echo ALEJO Comprehensive Test Runner
echo ==============================
echo.

REM Check for Python test runner
if exist run_comprehensive_tests.py (
    echo Found Python test runner
    echo Running Python tests...
    
    REM Try to run Python tests using direct python path
    echo Attempting to run Python tests with direct path...
    
    REM Try common Python installation paths
    set PYTHON_PATHS=C:\Python39\python.exe C:\Python310\python.exe C:\Python311\python.exe "C:\Program Files\Python39\python.exe" "C:\Program Files\Python310\python.exe" "C:\Program Files\Python311\python.exe" "%LOCALAPPDATA%\Programs\Python\Python39\python.exe" "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    
    for %%p in (%PYTHON_PATHS%) do (
        if exist %%p (
            echo Found Python at: %%p
            echo Running tests with this Python installation...
            %%p run_comprehensive_tests.py %*
            if errorlevel 0 (
                echo Python tests completed successfully
                goto python_done
            ) else (
                echo Python tests failed with error code: %errorlevel%
                goto python_done
            )
        )
    )
    
    echo Could not find Python installation
    
    :python_done
    echo.
) else (
    echo Python test runner not found
)

REM Check for Node.js test runner
if exist test\run_comprehensive_tests.js (
    echo Found Node.js test runner
    echo Running Node.js tests...
    
    REM Try to run Node.js tests using direct node path
    echo Attempting to run Node.js tests with direct path...
    
    REM Try common Node.js installation paths
    set NODE_PATHS="C:\Program Files\nodejs\node.exe" "C:\Program Files (x86)\nodejs\node.exe" "%APPDATA%\npm\node.exe" "%LOCALAPPDATA%\Programs\nodejs\node.exe"
    
    for %%n in (%NODE_PATHS%) do (
        if exist %%n (
            echo Found Node.js at: %%n
            echo Running tests with this Node.js installation...
            %%n test\run_comprehensive_tests.js %*
            if errorlevel 0 (
                echo Node.js tests completed successfully
                goto nodejs_done
            ) else (
                echo Node.js tests failed with error code: %errorlevel%
                goto nodejs_done
            )
        )
    )
    
    echo Could not find Node.js installation
    
    :nodejs_done
    echo.
) else (
    echo Node.js test runner not found
)

REM Check for code duplication reports
echo Checking for code duplication reports...
if exist code_duplicates_report.json (
    echo Found code duplicates report
    echo Analyzing code duplicates...
    type code_duplicates_report.json
    echo.
) else (
    echo No code duplicates report found
)

if exist duplicate_files_report.json (
    echo Found duplicate files report
    echo Analyzing duplicate files...
    type duplicate_files_report.json
    echo.
) else (
    echo No duplicate files report found
)

echo Test run completed
pause
