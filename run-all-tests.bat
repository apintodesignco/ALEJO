@echo off
set PATH= === Finding Python Installation ===  ? Found Python at C:\Users\magic\AppData\Local\Programs\Python\Python39 C:\Users\magic\AppData\Local\Programs\Python\Python39; === Finding Node.js Installation ===  ? Found Node.js at C:\Program Files\nodejs C:\Program Files\nodejs;%PATH%
cd %~dp0
echo Running ALEJO comprehensive tests...

echo.
echo === Running Python tests ===
echo.
if exist " === Finding Python Installation ===  ? Found Python at C:\Users\magic\AppData\Local\Programs\Python\Python39 C:\Users\magic\AppData\Local\Programs\Python\Python39\python.exe" (
    python run_comprehensive_tests.py --all
) else (
    echo Python not found, skipping Python tests
)

echo.
echo === Running Node.js tests ===
echo.
if exist " === Finding Node.js Installation ===  ? Found Node.js at C:\Program Files\nodejs C:\Program Files\nodejs\node.exe" (
    node test/run_comprehensive_tests.js --all
) else (
    echo Node.js not found, skipping Node.js tests
)
