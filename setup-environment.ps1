# ALEJO Project Environment Setup Script
Write-Host "Starting ALEJO environment setup..." -ForegroundColor Green

# 1. Verify Node.js and npm are installed
$nodeVersion = node -v
$npmVersion = npm -v
Write-Host "Current Node.js version: $nodeVersion" -ForegroundColor Cyan
Write-Host "Current npm version: $npmVersion" -ForegroundColor Cyan

# 2. Configure npm settings
Write-Host "Configuring npm settings..." -ForegroundColor Yellow
npm config set legacy-peer-deps true
npm config set fund false

# 3. Clean npm cache
Write-Host "Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force

# 4. Remove existing node_modules if present
if (Test-Path "node_modules") {
    Write-Host "Removing existing node_modules folder..." -ForegroundColor Yellow
    Remove-Item -Path "node_modules" -Recurse -Force
}

# 5. Remove package-lock.json if present
if (Test-Path "package-lock.json") {
    Write-Host "Removing package-lock.json..." -ForegroundColor Yellow
    Remove-Item -Path "package-lock.json" -Force
}

# 6. Install core dependencies globally
Write-Host "Installing core dependencies globally..." -ForegroundColor Yellow
npm install -g vite@5.0.0 @vitejs/plugin-legacy

# 7. Install project dependencies
Write-Host "Installing project dependencies..." -ForegroundColor Yellow
npm install --force

# 8. Install specific development dependencies
Write-Host "Installing specific development dependencies..." -ForegroundColor Yellow
npm install --save-dev vite@5.0.0 @vitejs/plugin-legacy terser

# 9. Creating npm shortcut scripts
Write-Host "Creating npm shortcut scripts..." -ForegroundColor Yellow
$devScript = @"
@echo off
echo Starting ALEJO development server...
npx --no-install vite --config vite.config.js
"@

$buildScript = @"
@echo off
echo Building ALEJO for production...
npx --no-install vite build --config vite.config.js
"@

Set-Content -Path "run-dev.cmd" -Value $devScript
Set-Content -Path "run-build.cmd" -Value $buildScript

Write-Host "Environment setup complete!" -ForegroundColor Green
Write-Host "You can now run the development server using ./run-dev.cmd" -ForegroundColor Green
Write-Host "Or build for production using ./run-build.cmd" -ForegroundColor Green
