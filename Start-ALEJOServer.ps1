# ALEJO Development Server - PowerShell Edition
param(
    [int]$Port = 5173,
    [string]$Directory = "src"
)

Write-Host "🚀 Starting ALEJO Development Server..." -ForegroundColor Green
Write-Host "📁 Serving files from: $(Resolve-Path $Directory)" -ForegroundColor Cyan
Write-Host "🌐 Server will run at: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "🔧 Press Ctrl+C to stop the server" -ForegroundColor Yellow

# Check if the source directory exists
if (-not (Test-Path $Directory)) {
    Write-Host "❌ Error: $Directory directory not found!" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Red
    exit 1
}

# Create a simple HTTP listener
Add-Type -AssemblyName System.Net.Http

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
    Write-Host "✅ Server started successfully!" -ForegroundColor Green
    
    # Open browser
    Start-Process "http://localhost:$Port"
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Get the requested file path
        $requestedPath = $request.Url.AbsolutePath.TrimStart('/')
        if ($requestedPath -eq "" -or $requestedPath -eq "/") {
            $requestedPath = "index.html"
        }
        
        $filePath = Join-Path $Directory $requestedPath
        
        Write-Host "📄 Request: $($request.HttpMethod) $($request.Url.AbsolutePath)" -ForegroundColor Gray
        
        if (Test-Path $filePath -PathType Leaf) {
            # Serve the file
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            
            # Set content type based on file extension
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($extension) {
                ".html" { $response.ContentType = "text/html" }
                ".css" { $response.ContentType = "text/css" }
                ".js" { $response.ContentType = "application/javascript" }
                ".json" { $response.ContentType = "application/json" }
                ".png" { $response.ContentType = "image/png" }
                ".jpg" { $response.ContentType = "image/jpeg" }
                ".jpeg" { $response.ContentType = "image/jpeg" }
                ".gif" { $response.ContentType = "image/gif" }
                ".svg" { $response.ContentType = "image/svg+xml" }
                default { $response.ContentType = "application/octet-stream" }
            }
            
            # Add CORS headers
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            
            $response.OutputStream.Write($content, 0, $content.Length)
            $response.StatusCode = 200
        } else {
            # File not found - serve index.html for SPA routing
            $indexPath = Join-Path $Directory "index.html"
            if (Test-Path $indexPath) {
                $content = [System.IO.File]::ReadAllBytes($indexPath)
                $response.ContentLength64 = $content.Length
                $response.ContentType = "text/html"
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
                $response.OutputStream.Write($content, 0, $content.Length)
                $response.StatusCode = 200
            } else {
                # 404 Not Found
                $errorContent = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found")
                $response.ContentLength64 = $errorContent.Length
                $response.ContentType = "text/plain"
                $response.OutputStream.Write($errorContent, 0, $errorContent.Length)
                $response.StatusCode = 404
            }
        }
        
        $response.Close()
    }
} catch {
    Write-Host "❌ Error starting server: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
        Write-Host "👋 Server stopped." -ForegroundColor Yellow
    }
}
