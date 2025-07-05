# ALEJO Comprehensive Environment Fix Script
# This script provides a complete solution for fixing environment issues in the ALEJO project
# It handles Node.js PATH configuration, Python PATH configuration, and dependency installation

# Set error action preference to stop on any error
$ErrorActionPreference = "Stop"

# ANSI color codes for PowerShell output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success($message) {
    Write-ColorOutput Green "✓ $message"
}

function Write-Error($message) {
    Write-ColorOutput Red "✗ $message"
}

function Write-Warning($message) {
    Write-ColorOutput Yellow "⚠ $message"
}

function Write-Section($title) {
    Write-Output ""
    Write-ColorOutput Cyan "=== $title ==="
    Write-Output ""
}

# Check if running as administrator
function Test-Administrator {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Main function
function Main {
    Write-ColorOutput Cyan "ALEJO Comprehensive Environment Fix"
    Write-ColorOutput Cyan "=================================="
    Write-Output ""

    # Check if running as administrator
    if (-not (Test-Administrator)) {
        Write-Warning "This script should be run as Administrator for best results."
        Write-Warning "Some operations may fail without administrator privileges."
        $continue = Read-Host "Do you want to continue anyway? (y/n)"
        if ($continue -ne "y") {
            exit 1
        }
    }

    # Step 1: Find Node.js and Python installations
    $nodeInstallPath = Find-NodeJs
    $pythonInstallPath = Find-Python

    # Step 2: Fix environment PATH variables
    Fix-EnvironmentPath $nodeInstallPath $pythonInstallPath

    # Step 3: Create wrapper scripts for running tests
    Create-WrapperScripts $nodeInstallPath $pythonInstallPath

    # Step 4: Fix module system inconsistencies
    Fix-ModuleSystem $nodeInstallPath

    # Step 5: Install required dependencies
    Install-Dependencies $nodeInstallPath

    Write-Success "Environment fix completed successfully!"
    Write-Output ""
    Write-Output "To run tests, use one of the following commands:"
    Write-Output "  .\run-tests.bat --all       # Run all Python tests"
    Write-Output "  .\run-node-tests.bat        # Run all Node.js tests"
    Write-Output ""
    Write-Warning "You may need to restart your terminal or IDE for all changes to take effect."
}

# Find Node.js installation
function Find-NodeJs {
    Write-Section "Finding Node.js Installation"
    
    $possiblePaths = @(
        "C:\Program Files\nodejs",
        "C:\Program Files (x86)\nodejs",
        "$env:APPDATA\npm",
        "$env:LOCALAPPDATA\Programs\nodejs"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path "$path\node.exe") {
            Write-Success "Found Node.js at $path"
            return $path
        }
    }
    
    # Try to find Node.js in PATH
    try {
        $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
        if ($nodePath) {
            $nodeDir = Split-Path -Parent $nodePath
            Write-Success "Found Node.js in PATH at $nodeDir"
            return $nodeDir
        }
    }
    catch {
        # Node.js not found in PATH
    }
    
    Write-Warning "Node.js not found. Please install Node.js and try again."
    Write-Warning "You can download Node.js from https://nodejs.org/"
    
    $installNode = Read-Host "Do you want this script to download and install Node.js for you? (y/n)"
    if ($installNode -eq "y") {
        return Install-NodeJs
    }
    
    exit 1
}

# Find Python installation
function Find-Python {
    Write-Section "Finding Python Installation"
    
    $possiblePaths = @(
        "C:\Python39",
        "C:\Python310",
        "C:\Python311",
        "C:\Program Files\Python39",
        "C:\Program Files\Python310",
        "C:\Program Files\Python311",
        "$env:LOCALAPPDATA\Programs\Python\Python39",
        "$env:LOCALAPPDATA\Programs\Python\Python310",
        "$env:LOCALAPPDATA\Programs\Python\Python311"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path "$path\python.exe") {
            Write-Success "Found Python at $path"
            return $path
        }
    }
    
    # Try to find Python in PATH
    try {
        $pythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source
        if ($pythonPath) {
            $pythonDir = Split-Path -Parent $pythonPath
            Write-Success "Found Python in PATH at $pythonDir"
            return $pythonDir
        }
    }
    catch {
        # Python not found in PATH
    }
    
    Write-Warning "Python not found. Some tests may not run properly."
    Write-Warning "You can download Python from https://www.python.org/"
    
    return $null
}

# Install Node.js
function Install-NodeJs {
    Write-Section "Installing Node.js"

    $tempDir = [System.IO.Path]::GetTempPath()
    $nodejsInstallerPath = Join-Path $tempDir "node-installer.msi"
    
    # Download Node.js installer
    Write-Output "Downloading Node.js installer..."
    $nodejsUrl = "https://nodejs.org/dist/v18.17.1/node-v18.17.1-x64.msi"
    try {
        Invoke-WebRequest -Uri $nodejsUrl -OutFile $nodejsInstallerPath
        Write-Success "Downloaded Node.js installer"
    }
    catch {
        Write-Error "Failed to download Node.js installer: $_"
        exit 1
    }

    # Install Node.js
    Write-Output "Installing Node.js (this may take a few minutes)..."
    try {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $nodejsInstallerPath, "/quiet", "/norestart" -Wait
        Write-Success "Node.js installed successfully"
    }
    catch {
        Write-Error "Failed to install Node.js: $_"
        exit 1
    }
    
    # Clean up
    Remove-Item $nodejsInstallerPath -Force
    
    return "C:\Program Files\nodejs"
}

# Fix environment PATH variables
function Fix-EnvironmentPath($nodeInstallPath, $pythonInstallPath) {
    Write-Section "Fixing Environment PATH Variables"
    
    # Fix Node.js PATH for current process
    if ($nodeInstallPath) {
        if (-not ($env:Path -like "*$nodeInstallPath*")) {
            $env:Path = "$nodeInstallPath;$env:Path"
            Write-Success "Added Node.js to PATH for current process"
        }
        
        # Add Node.js to system PATH if running as admin
        if (Test-Administrator) {
            $systemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            if (-not ($systemPath -like "*$nodeInstallPath*")) {
                $newPath = "$nodeInstallPath;$systemPath"
                [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
                Write-Success "Added Node.js to system PATH permanently"
            }
        }
        else {
            Write-Warning "Not running as Administrator - Node.js will only be in PATH for this session"
        }
    }
    
    # Fix Python PATH for current process
    if ($pythonInstallPath) {
        if (-not ($env:Path -like "*$pythonInstallPath*")) {
            $env:Path = "$pythonInstallPath;$env:Path"
            Write-Success "Added Python to PATH for current process"
        }
        
        # Add Python to system PATH if running as admin
        if (Test-Administrator) {
            $systemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            if (-not ($systemPath -like "*$pythonInstallPath*")) {
                $newPath = "$pythonInstallPath;$systemPath"
                [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
                Write-Success "Added Python to system PATH permanently"
            }
        }
        else {
            Write-Warning "Not running as Administrator - Python will only be in PATH for this session"
        }
    }
    
    # Verify Node.js is now accessible
    try {
        $nodeVersion = & "$nodeInstallPath\node.exe" -v
        Write-Success "Node.js $nodeVersion is now accessible"
    }
    catch {
        Write-Error "Node.js is still not accessible: $_"
    }
    
    # Verify npm is now accessible
    try {
        $npmVersion = & "$nodeInstallPath\npm.cmd" -v
        Write-Success "npm $npmVersion is now accessible"
    }
    catch {
        Write-Error "npm is still not accessible: $_"
    }
    
    # Verify Python is now accessible if it was found
    if ($pythonInstallPath) {
        try {
            $pythonVersion = & "$pythonInstallPath\python.exe" --version
            Write-Success "Python $pythonVersion is now accessible"
        }
        catch {
            Write-Error "Python is still not accessible: $_"
        }
    }
}

# Create wrapper scripts for running tests
function Create-WrapperScripts($nodeInstallPath, $pythonInstallPath) {
    Write-Section "Creating Wrapper Scripts"
    
    $projectRoot = $PSScriptRoot
    
    # Create Node.js test wrapper
    $nodeTestsWrapper = Join-Path $projectRoot "run-node-tests.bat"
    @"
@echo off
set PATH=$nodeInstallPath;%PATH%
cd %~dp0
echo Running ALEJO Node.js tests...
node test/run_comprehensive_tests.js %*
"@ | Out-File -FilePath $nodeTestsWrapper -Encoding ASCII
    Write-Success "Created Node.js test runner: run-node-tests.bat"
    
    # Create Python test wrapper if Python was found
    if ($pythonInstallPath) {
        $pythonTestsWrapper = Join-Path $projectRoot "run-tests.bat"
        @"
@echo off
set PATH=$pythonInstallPath;$nodeInstallPath;%PATH%
cd %~dp0
echo Running ALEJO comprehensive tests...
python run_comprehensive_tests.py %*
"@ | Out-File -FilePath $pythonTestsWrapper -Encoding ASCII
        Write-Success "Created Python test runner: run-tests.bat"
    }
    
    # Create a comprehensive test wrapper that tries both
    $comprehensiveWrapper = Join-Path $projectRoot "run-all-tests.bat"
    @"
@echo off
set PATH=$pythonInstallPath;$nodeInstallPath;%PATH%
cd %~dp0
echo Running ALEJO comprehensive tests...

echo.
echo === Running Python tests ===
echo.
if exist "$pythonInstallPath\python.exe" (
    python run_comprehensive_tests.py --all
) else (
    echo Python not found, skipping Python tests
)

echo.
echo === Running Node.js tests ===
echo.
if exist "$nodeInstallPath\node.exe" (
    node test/run_comprehensive_tests.js --all
) else (
    echo Node.js not found, skipping Node.js tests
)
"@ | Out-File -FilePath $comprehensiveWrapper -Encoding ASCII
    Write-Success "Created comprehensive test runner: run-all-tests.bat"
}

# Fix module system inconsistencies
function Fix-ModuleSystem($nodeInstallPath) {
    Write-Section "Fixing Module System"
    
    $projectRoot = $PSScriptRoot
    
    # Run the module system fixer script
    try {
        Write-Output "Running module system fixer..."
        & "$nodeInstallPath\node.exe" "$projectRoot\tools\fix-module-system.js"
        Write-Success "Module system fixed successfully"
    }
    catch {
        Write-Error "Failed to fix module system: $_"
    }
}

# Install required dependencies
function Install-Dependencies($nodeInstallPath) {
    Write-Section "Installing Required Dependencies"
    
    $projectRoot = $PSScriptRoot
    
    # Check if package.json exists
    if (-not (Test-Path "$projectRoot\package.json")) {
        Write-Warning "package.json not found, skipping dependency installation"
        return
    }
    
    # Install npm dependencies
    try {
        Write-Output "Installing npm dependencies (this may take a few minutes)..."
        Set-Location $projectRoot
        & "$nodeInstallPath\npm.cmd" install
        Write-Success "Dependencies installed successfully"
    }
    catch {
        Write-Error "Failed to install dependencies: $_"
    }
}

# Run the main function
Main
