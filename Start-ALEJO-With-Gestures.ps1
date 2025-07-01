# ALEJO with Gesture System Startup Script
# PowerShell script to start ALEJO with gesture support

param (
    [switch]$NoGesture = $false,
    [string]$AccessibilityLevel = "enhanced",
    [int]$WebPort = 8000,
    [int]$WsPort = 8765,
    [switch]$NoBrowser = $false,
    [switch]$Validate = $false,
    [string]$Mode = "docker"
)

# Display banner
Write-Host "=================================================="
Write-Host "  ALEJO SYSTEM WITH GESTURE SUPPORT"
Write-Host "=================================================="

# Check if Python is installed
try {
    $pythonVersion = python --version
    Write-Host "✅ Python detected: $pythonVersion"
}
catch {
    Write-Host "❌ Python not found. Please install Python 3.9+ and try again."
    exit 1
}

# Check if Docker is installed (if using docker mode)
if ($Mode -eq "docker") {
    try {
        $dockerVersion = docker --version
        Write-Host "✅ Docker detected: $dockerVersion"
        
        $dockerComposeVersion = docker-compose --version
        Write-Host "✅ Docker Compose detected: $dockerComposeVersion"
    }
    catch {
        Write-Host "❌ Docker or Docker Compose not found. Please install Docker Desktop and try again."
        Write-Host "   Alternatively, use -Mode local to run without Docker."
        exit 1
    }
}

# Build command arguments
$arguments = @("start_alejo_with_gestures.py")
$arguments += "--mode", $Mode
$arguments += "--web-port", $WebPort
$arguments += "--ws-port", $WsPort
$arguments += "--accessibility", $AccessibilityLevel

if ($NoGesture) {
    $arguments += "--no-gesture"
}

if ($NoBrowser) {
    $arguments += "--no-browser"
}

if ($Validate) {
    $arguments += "--validate"
}

# Display configuration
Write-Host ""
Write-Host "Configuration:"
Write-Host "  Mode: $Mode"
Write-Host "  Web Port: $WebPort"
Write-Host "  WebSocket Port: $WsPort"
Write-Host "  Gesture System: $(if ($NoGesture) { 'Disabled' } else { 'Enabled' })"
if (-not $NoGesture) {
    Write-Host "  Accessibility Level: $AccessibilityLevel"
}
Write-Host "  Open Browser: $(if ($NoBrowser) { 'No' } else { 'Yes' })"
Write-Host "  Validate Deployment: $(if ($Validate) { 'Yes' } else { 'No' })"
Write-Host ""

# Start the system
Write-Host "Starting ALEJO with gesture support..."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

# Execute the Python script
& python $arguments

# Display access information
Write-Host ""
Write-Host "=================================================="
Write-Host "  ALEJO SYSTEM ACCESS"
Write-Host "=================================================="
Write-Host "  Web Interface:     http://localhost:$WebPort"
if (-not $NoGesture) {
    Write-Host "  Gesture Interface: http://localhost:$WebPort/gestures"
    Write-Host "  WebSocket Server:  ws://localhost:$WsPort"
}
Write-Host "=================================================="
