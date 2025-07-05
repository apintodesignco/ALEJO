@echo off
set PATH= === Finding Python Installation ===  ? Found Python at C:\Users\magic\AppData\Local\Programs\Python\Python39 C:\Users\magic\AppData\Local\Programs\Python\Python39; === Finding Node.js Installation ===  ? Found Node.js at C:\Program Files\nodejs C:\Program Files\nodejs;%PATH%
cd %~dp0
echo Running ALEJO comprehensive tests...
python run_comprehensive_tests.py %*
