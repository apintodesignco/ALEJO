@echo off
setlocal
echo Running ALEJO Comprehensive Tests
echo ================================
echo.

REM Define common paths where Python and Node.js might be installed
set "PYTHON_PATHS="C:\Python39\python.exe" "C:\Python310\python.exe" "C:\Python311\python.exe" "C:\Users\magic\AppData\Local\Programs\Python\Python39\python.exe" "C:\Users\magic\AppData\Local\Programs\Python\Python310\python.exe" "C:\Users\magic\AppData\Local\Programs\Python\Python311\python.exe""
set "NODE_PATHS="C:\Program Files\nodejs\node.exe" "C:\Program Files (x86)\nodejs\node.exe" "C:\Users\magic\AppData\Roaming\nvm\v16.20.0\node.exe" "C:\Users\magic\AppData\Roaming\nvm\v18.16.0\node.exe""

REM Find Python
set PYTHON_FOUND=0
for %%p in (%PYTHON_PATHS%) do (
    if exist %%~p (
        set "PYTHON_PATH=%%~p"
        set PYTHON_FOUND=1
        echo Found Python: "%%~p"
        goto :python_found
    )
)
:python_found

REM Find Node.js
set NODE_FOUND=0
for %%n in (%NODE_PATHS%) do (
    if exist %%~n (
        set "NODE_PATH=%%~n"
        set NODE_FOUND=1
        echo Found Node.js: "%%~n"
        goto :node_found
    )
)
:node_found

echo.
echo === Running Code Duplication Analysis ===
if %PYTHON_FOUND% EQU 1 (
    echo Running code duplication analysis...
    "%PYTHON_PATH%" "tools\code_duplication_analyzer.py"
) else (
    echo Python not found, skipping code duplication analysis
)

echo.
echo === Running Python Tests ===
if %PYTHON_FOUND% EQU 1 (
    echo Running Python tests...
    "C:\Users\magic\AppData\Local\Programs\Python\Python39\Scripts\pytest.exe" "C:\Users\magic\CascadeProjects\ALEJO\tests" -vv --capture=no
) else (
    echo Python not found, skipping Python tests
)

echo.
echo === Running Node.js Tests ===
if %NODE_FOUND% EQU 1 (
    echo Running Node.js tests...
    "%NODE_PATH%" "tools\run_comprehensive_tests.js"
) else (
    echo Node.js not found, skipping Node.js tests
)

echo.
echo === Running Security Tests ===
if %PYTHON_FOUND% EQU 1 (
    echo Running security tests...
    "%PYTHON_PATH%" "tests\security\run_security_tests.py"
) else (
    echo Python not found, skipping security tests
)

echo.
echo === Running Accessibility Tests ===
if %NODE_FOUND% EQU 1 (
    echo Running accessibility tests...
    "%NODE_PATH%" "tests\accessibility\run_accessibility_tests.js"
) else (
    echo Node.js not found, skipping accessibility tests
)

echo.
echo === Test Summary ===
echo Tests completed. Check the output above for any failures.
echo.
endlocal


