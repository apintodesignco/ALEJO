# ALEJO All-in-One Installer

# Download and install Node.js
$nodeUrl = "https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi"
$nodeInstaller = "$env:TEMP\nodejs-installer.msi"
Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
Start-Process msiexec -ArgumentList "/i $nodeInstaller /quiet" -Wait

# Download and install Python
$pythonUrl = "https://www.python.org/ftp/python/3.11.4/python-3.11.4-amd64.exe"
$pythonInstaller = "$env:TEMP\python-installer.exe"
Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller
Start-Process $pythonInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait

# Update PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verify installations
node --version
npm --version
python --version

# Install dependencies
npm install

# Run tests
npm test

# Start ALEJO
Start-Process npm -ArgumentList "run dev"
Start-Process "http://localhost:3000"
