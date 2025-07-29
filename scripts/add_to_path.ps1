# Temporarily add Node.js and Python to PATH for current session

# Common Node.js installation paths
$nodePaths = @(
  "$env:ProgramFiles\nodejs",
  "$env:LocalAppData\nvs\default",
  "$env:USERPROFILE\AppData\Roaming\nvm"
)

# Common Python installation paths
$pythonPaths = @(
  "$env:LocalAppData\Programs\Python\Python311",
  "$env:LocalAppData\Programs\Python\Python310",
  "$env:LocalAppData\Programs\Python\Python39",
  "$env:ProgramFiles\Python311",
  "$env:ProgramFiles\Python310",
  "$env:ProgramFiles\Python39"
)

# Add valid paths to temporary PATH
$env:Path = (
  $nodePaths.Where{ Test-Path $_ } | 
  ForEach-Object { "$_;$env:Path" } | 
  Select-Object -First 1
)

$env:Path = (
  $pythonPaths.Where{ Test-Path $_ } | 
  ForEach-Object { "$_;$env:Path" } | 
  Select-Object -First 1
)

# Verify installations
Write-Host "Node.js version: $(node --version 2>&1)"
Write-Host "npm version: $(npm --version 2>&1)"
Write-Host "Python version: $(python --version 2>&1)"

# Permanent setup instructions
Write-Host "`nFor permanent setup, add these paths to your system PATH environment variable:"
Write-Host "Node.js: $($nodePaths.Where{ Test-Path $_ } | Select-Object -First 1)"
Write-Host "Python: $($pythonPaths.Where{ Test-Path $_ } | Select-Object -First 1)"
