# Check for Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Please install from https://python.org" -ForegroundColor Red
    exit 1
}

# Check for Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check for npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

Write-Host "Environment check passed. Python $(python --version) and Node.js $(node --version) are available." -ForegroundColor Green
