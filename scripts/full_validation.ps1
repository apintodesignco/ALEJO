# Full ALEJO Validation Script

# Step 1: Create temp directory
$tempDir = "$env:TEMP\alejo-validation-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $tempDir | Out-Null
Set-Location $tempDir

# Step 2: Download latest release
$repo = "apintodesignco/ALEJO"
$releaseUrl = "https://github.com/$repo/releases/latest/download/ALEJO.zip"
$zipPath = "$tempDir\ALEJO.zip"
Invoke-WebRequest -Uri $releaseUrl -OutFile $zipPath

# Step 3: Extract and enter directory
Expand-Archive -Path $zipPath -DestinationPath .
Set-Location "$tempDir\ALEJO"

# Step 4: Install dependencies
& .\scripts\setup_environment.ps1
npm install

# Step 5: Run comprehensive tests
python run_comprehensive_tests.py
npm test

# Step 6: Start application
Start-Process npm -ArgumentList "run dev" -NoNewWindow

# Step 7: Automated UI testing
& .\scripts\ui_test.ps1

# Step 8: Verification
Write-Host "`n✅ ALEJO validation completed successfully!" -ForegroundColor Green
Write-Host "Application running at http://localhost:3000"
