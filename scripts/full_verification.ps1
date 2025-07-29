# Full Verification Script for ALEJO

# Step 1: Verify Environment
Write-Host "Verifying Environment..."
$requiredCommands = @('node', 'npm', 'python')
foreach ($cmd in $requiredCommands) {
    try {
        $version = & $cmd --version 2>&1
        Write-Host "$cmd version: $version"
    } catch {
        Write-Host "$cmd is not installed or not in PATH. Please install and configure it." -ForegroundColor Red
        exit 1
    }
}

# Step 2: Install Dependencies
Write-Host "Installing Dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed" -ForegroundColor Red
    exit 1
}

# Step 3: Run Tests
Write-Host "Running Tests..."
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed" -ForegroundColor Red
    exit 1
}

# Step 4: Start Application
Write-Host "Starting ALEJO..."
Start-Process npm -ArgumentList "run dev" -NoNewWindow
Write-Host "ALEJO is running at http://localhost:3000"

# Step 5: Open in Browser
Start-Process "http://localhost:3000"
