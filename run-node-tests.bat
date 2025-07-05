@echo off
set PATH= === Finding Node.js Installation ===  ? Found Node.js at C:\Program Files\nodejs C:\Program Files\nodejs;%PATH%
cd %~dp0
echo Running ALEJO Node.js tests...
node test/run_comprehensive_tests.js %*
