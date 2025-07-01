# Start-ALEJO.ps1
# PowerShell script to launch ALEJO - Advanced Language and Execution Joint Operator
# A world-class AI system designed to be a defender, helper, and protector of mankind

# Set error action preference
$ErrorActionPreference = "Stop"

# Define the ALEJO root directory
$alejoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Function to check if Python is installed
function Test-PythonInstalled {
    try {
        $pythonVersion = python --version
        Write-Host "Found Python: $pythonVersion"
        return $true
    }
    catch {
        Write-Host "Python is not installed or not in PATH. Please install Python 3.8 or higher."
        return $false
    }
}

# Function to check if virtual environment exists
function Test-VenvExists {
    $venvPath = Join-Path $alejoRoot "venv"
    if (Test-Path $venvPath) {
        Write-Host "Virtual environment found at: $venvPath"
        return $true
    }
    else {
        Write-Host "Virtual environment not found. Will create one."
        return $false
    }
}

# Function to create virtual environment
function New-VirtualEnvironment {
    Write-Host "Creating virtual environment..."
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create virtual environment. Please check your Python installation."
        exit 1
    }
    Write-Host "Virtual environment created successfully."
}

# Function to activate virtual environment
function Enable-VirtualEnvironment {
    $activateScript = Join-Path $alejoRoot "venv\Scripts\Activate.ps1"
    if (Test-Path $activateScript) {
        Write-Host "Activating virtual environment..."
        & $activateScript
    }
    else {
        Write-Host "Activation script not found at: $activateScript"
        exit 1
    }
}

# Function to install dependencies
function Install-Dependencies {
    $requirementsFile = Join-Path $alejoRoot "requirements.txt"
    if (Test-Path $requirementsFile) {
        Write-Host "Installing dependencies from requirements.txt..."
        pip install -r $requirementsFile
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to install dependencies. Please check your internet connection and try again."
            exit 1
        }
        Write-Host "Dependencies installed successfully."
    }
    else {
        Write-Host "Requirements file not found at: $requirementsFile"
        exit 1
    }
}

# Function to check for admin privileges
function Test-AdminPrivileges {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Function to restart script with admin privileges
function Restart-ScriptAsAdmin {
    $scriptPath = $MyInvocation.MyCommand.Path
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
    Start-Process powershell -Verb RunAs -ArgumentList $arguments
    exit
}

# Function to create desktop shortcut
function New-ALEJOShortcut {
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktopPath "ALEJO.lnk"
    $iconPath = Join-Path $alejoRoot "assets\alejo_icon.ico"
    
    if (-not (Test-Path $iconPath)) {
        $iconPath = Join-Path $alejoRoot "assets\alejo_icon.png"
    }
    
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$alejoRoot\Start-ALEJO.ps1`""
    $Shortcut.WorkingDirectory = $alejoRoot
    $Shortcut.IconLocation = $iconPath
    $Shortcut.Description = "Start ALEJO AI Assistant"
    $Shortcut.Save()
    
    Write-Host "Desktop shortcut created at: $shortcutPath"
}

# Function to download icon if needed
function Get-ALEJOIcon {
    $iconScript = Join-Path $alejoRoot "assets\download_icon.py"
    if (Test-Path $iconScript) {
        Write-Host "Ensuring ALEJO has a high-quality icon..."
        python $iconScript
    }
}

# Function to create startup sound if needed
function Get-ALEJOStartupSound {
    $soundScript = Join-Path $alejoRoot "assets\create_startup_sound.py"
    $soundFile = Join-Path $alejoRoot "assets\sounds\alejo_startup.wav"
    
    if ((Test-Path $soundScript) -and (-not (Test-Path $soundFile))) {
        Write-Host "Creating ALEJO's futuristic startup sound..."
        python $soundScript
    }
}

# Function to start ALEJO
function Start-ALEJOApp {
    param (
        [int]$Port = 8000,
        [string]$HostName = "127.0.0.1",
        [switch]$Debug,
        [switch]$NoBrowser,
        [switch]$OptimizeResources,
        [switch]$EnableComfort,
        [switch]$SkipStartup
    )
    
    # Use the optimized runner script
    $runAlejoScript = Join-Path $alejoRoot "run_alejo_optimized.py"
    
    # Fall back to other scripts if optimized one doesn't exist
    if (-not (Test-Path $runAlejoScript)) {
        $runAlejoScript = Join-Path $alejoRoot "run_alejo.py"
    }
    
    if (-not (Test-Path $runAlejoScript)) {
        $runAlejoScript = Join-Path $alejoRoot "alejo.py"
    }
    
    if (Test-Path $runAlejoScript) {
        $arguments = @()
        
        $arguments += "--port", $Port
        $arguments += "--host", $HostName
        
        if ($Debug) {
            $arguments += "--debug"
        }
        
        if ($NoBrowser) {
            $arguments += "--no-browser"
        }
        
        if ($OptimizeResources) {
            $arguments += "--optimize-resources"
        }
        
        if ($EnableComfort) {
            $arguments += "--enable-comfort"
        }
        
        if ($SkipStartup) {
            $arguments += "--skip-startup"
        }
        
        Write-Host "Starting ALEJO with extraordinary startup sequence..."
        Write-Host "Arguments: $arguments"
        python $runAlejoScript $arguments
    }
    else {
        Write-Host "ALEJO scripts not found at: $runAlejoScript"
        exit 1
    }
}

# Main script execution
Write-Host "===== ALEJO - Advanced Language and Execution Joint Operator =====" 
Write-Host "===== Defender | Helper | Protector of Mankind ====="
Write-Host "Current directory: $alejoRoot"

# Check for admin privileges and restart if needed
if (-not (Test-AdminPrivileges)) {
    Write-Host "ALEJO requires administrator privileges for full functionality."
    Write-Host "Restarting with elevated permissions..."
    Restart-ScriptAsAdmin
}

# Change to ALEJO root directory
Set-Location $alejoRoot

# Check if Python is installed
if (-not (Test-PythonInstalled)) {
    exit 1
}

# Check if virtual environment exists, create if not
if (-not (Test-VenvExists)) {
    New-VirtualEnvironment
}

# Enable virtual environment
Enable-VirtualEnvironment

# Install dependencies
Install-Dependencies

# Ensure ALEJO has its icon
Get-ALEJOIcon

# Ensure ALEJO has its startup sound
Get-ALEJOStartupSound

# Create desktop shortcut if it doesn't exist
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "ALEJO.lnk"
if (-not (Test-Path $desktopShortcut)) {
    New-ALEJOShortcut
}

# Start ALEJO with optimized parameters
Start-ALEJOApp -Port 8000 -HostName "127.0.0.1" -OptimizeResources -EnableComfort
