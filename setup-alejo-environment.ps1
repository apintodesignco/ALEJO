# ALEJO Comprehensive Environment Setup Script
# This script provides a complete solution for setting up the ALEJO development environment
# It handles Node.js installation, PATH configuration, and dependency installation

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
    Write-ColorOutput Cyan "ALEJO Environment Setup"
    Write-ColorOutput Cyan "======================"
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

    # Step 1: Check if Node.js is installed
    $nodeInstalled = $false
    try {
        $nodeVersion = node -v
        $npmVersion = npm -v
        Write-Success "Node.js $nodeVersion is installed"
        Write-Success "npm $npmVersion is installed"
        $nodeInstalled = $true
    }
    catch {
        Write-Warning "Node.js is not installed or not in PATH"
    }

    # Step 2: Install Node.js if needed
    if (-not $nodeInstalled) {
        Install-NodeJS
    }

    # Step 3: Add Node.js to PATH if needed
    if (-not $nodeInstalled) {
        Add-NodeJsToPath
    }

    # Step 4: Install required dependencies
    Install-Dependencies

    # Step 5: Fix module system inconsistencies
    Fix-ModuleSystem

    # Step 6: Set up the environment for running tests
    Setup-TestEnvironment

    Write-Success "Environment setup completed successfully!"
    Write-Success "Your ALEJO development environment is now ready."
}

# Install Node.js
function Install-NodeJS {
    Write-Section "Installing Node.js"

    $nodejsInstallerPath = Join-Path $PSScriptRoot "node-installer.msi"
    
    # Check if the installer exists
    if (Test-Path $nodejsInstallerPath) {
        Write-Output "Using existing Node.js installer"
    }
    else {
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
}

# Add Node.js to PATH
function Add-NodeJsToPath {
    Write-Section "Adding Node.js to PATH"

    $nodePath = "C:\Program Files\nodejs"
    
    # Check if Node.js is installed at the expected location
    if (-not (Test-Path "$nodePath\node.exe")) {
        Write-Error "Node.js executable not found at $nodePath\node.exe"
        Write-Error "Please verify the Node.js installation path."
        exit 1
    }

    # Get current PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Process")

    # Check if Node.js is already in PATH
    if ($currentPath -like "*$nodePath*") {
        Write-Success "Node.js is already in your PATH."
    }
    else {
        # Add Node.js to PATH for current process
        $env:Path = "$env:Path;$nodePath"
        Write-Success "Node.js added to PATH for current process"

        # Add Node.js to PATH permanently if running as admin
        if (Test-Administrator) {
            $systemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            if (-not ($systemPath -like "*$nodePath*")) {
                $newPath = "$systemPath;$nodePath"
                [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
                Write-Success "Node.js added to system PATH permanently"
            }
        }
        else {
            Write-Warning "Not running as Administrator - Node.js will only be in PATH for this session"
            Write-Warning "To add Node.js to PATH permanently, run this script as Administrator"
        }
    }

    # Verify Node.js is now accessible
    try {
        $nodeVersion = node -v
        $npmVersion = npm -v
        Write-Success "Node.js $nodeVersion is now accessible"
        Write-Success "npm $npmVersion is now accessible"
    }
    catch {
        Write-Error "Node.js is still not accessible. Please restart your terminal and try again."
        exit 1
    }
}

# Install required dependencies
function Install-Dependencies {
    Write-Section "Installing Required Dependencies"

    # Create temporary batch file to ensure npm is in PATH
    $batchFile = Join-Path $env:TEMP "npm-install.bat"
    @"
@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd $PSScriptRoot
npm install --save-dev @axe-core/puppeteer@4.8.1 @babel/core@7.22.5 @babel/register@7.22.5 axe-html-reporter@2.2.3 chai@4.3.7 express@4.18.2 mocha@10.2.0 mocha-html-reporter@0.0.1 mochawesome@7.1.3 puppeteer@21.5.0 sinon@15.2.0 yargs@17.7.2
npm install --save face-api.js@0.22.2 tensorflow@0.2.0 web-speech-cognitive-services@7.1.3
"@ | Out-File -FilePath $batchFile -Encoding ASCII

    # Run the batch file
    Write-Output "Installing npm dependencies (this may take a few minutes)..."
    try {
        Start-Process -FilePath $batchFile -Wait
        Write-Success "Dependencies installed successfully"
    }
    catch {
        Write-Error "Failed to install dependencies: $_"
        exit 1
    }
    finally {
        # Clean up
        if (Test-Path $batchFile) {
            Remove-Item $batchFile
        }
    }
}

# Fix module system inconsistencies
function Fix-ModuleSystem {
    Write-Section "Fixing Module System"

    # Create temporary batch file to run the module system fixer
    $batchFile = Join-Path $env:TEMP "fix-modules.bat"
    @"
@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd $PSScriptRoot
node tools/fix-module-system.js
"@ | Out-File -FilePath $batchFile -Encoding ASCII

    # Run the batch file
    Write-Output "Fixing module system inconsistencies..."
    try {
        Start-Process -FilePath $batchFile -Wait
        Write-Success "Module system fixed successfully"
    }
    catch {
        Write-Error "Failed to fix module system: $_"
        exit 1
    }
    finally {
        # Clean up
        if (Test-Path $batchFile) {
            Remove-Item $batchFile
        }
    }
}

# Set up the environment for running tests
function Setup-TestEnvironment {
    Write-Section "Setting Up Test Environment"

    # Create batch wrappers for running tests
    $runTestsWrapper = Join-Path $PSScriptRoot "run-tests-wrapper.bat"
    @"
@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd %~dp0
python run_comprehensive_tests.py %*
"@ | Out-File -FilePath $runTestsWrapper -Encoding ASCII

    Write-Success "Created test runner wrapper: run-tests-wrapper.bat"
    
    # Create Node.js test wrapper
    $nodeTestsWrapper = Join-Path $PSScriptRoot "run-node-tests-wrapper.bat"
    @"
@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd %~dp0
node test/run_comprehensive_tests.js %*
"@ | Out-File -FilePath $nodeTestsWrapper -Encoding ASCII

    Write-Success "Created Node.js test runner wrapper: run-node-tests-wrapper.bat"

    Write-Output ""
    Write-Output "To run tests, use one of the following commands:"
    Write-Output "  .\run-tests-wrapper.bat --all       # Run all Python tests"
    Write-Output "  .\run-node-tests-wrapper.bat        # Run all Node.js tests"
}

# Run the main function
Main
