# PowerShell script to permanently add Node.js to system PATH
# Must be run as Administrator

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "This script requires Administrator privileges to modify the system PATH."
    Write-Warning "Please right-click on PowerShell and select 'Run as Administrator', then run this script again."
    exit 1
}

$nodePath = "C:\Program Files\nodejs"

# Check if Node.js is installed at the expected location
if (-NOT (Test-Path "$nodePath\node.exe")) {
    Write-Error "Node.js executable not found at $nodePath\node.exe"
    Write-Error "Please verify the Node.js installation path."
    exit 1
}

# Get current PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Check if Node.js is already in PATH
if ($currentPath -like "*$nodePath*") {
    Write-Host "Node.js is already in your system PATH." -ForegroundColor Green
    exit 0
}

# Add Node.js to PATH
$newPath = "$currentPath;$nodePath"
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")

# Verify the change
$updatedPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($updatedPath -like "*$nodePath*") {
    Write-Host "Node.js has been successfully added to your system PATH." -ForegroundColor Green
    Write-Host "You may need to restart your terminal or IDE for the changes to take effect." -ForegroundColor Yellow
} else {
    Write-Error "Failed to add Node.js to system PATH."
    exit 1
}

# Display Node.js version
Write-Host "`nNode.js installation details:" -ForegroundColor Cyan
Write-Host "------------------------"
& "$nodePath\node.exe" -v
& "$nodePath\npm.cmd" -v

Write-Host "`nPATH environment variable has been updated successfully!" -ForegroundColor Green
