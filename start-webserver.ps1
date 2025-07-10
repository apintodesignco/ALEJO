$port = 8080
$root = Join-Path $PSScriptRoot "\"

Write-Host "Starting lightweight web server at http://localhost:$port/"
Write-Host "Serving files from: $root"
Write-Host "Press Ctrl+C to stop the server"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath
        $localPath = $localPath -replace "/", "\"
        
        if ($localPath -eq "\") {
            $localPath = "\index.html"
        }
        
        $physicalPath = Join-Path $root $localPath.Substring(1)
        
        Write-Host "Request: $($request.Url.LocalPath)"
        
        if (Test-Path $physicalPath) {
            # Get file content and set content type
            $content = [System.IO.File]::ReadAllBytes($physicalPath)
            
            # Set content type based on file extension
            $extension = [System.IO.Path]::GetExtension($physicalPath)
            switch ($extension) {
                ".html" { $response.ContentType = "text/html" }
                ".css" { $response.ContentType = "text/css" }
                ".js" { $response.ContentType = "application/javascript" }
                ".json" { $response.ContentType = "application/json" }
                ".png" { $response.ContentType = "image/png" }
                ".jpg" { $response.ContentType = "image/jpeg" }
                ".gif" { $response.ContentType = "image/gif" }
                default { $response.ContentType = "application/octet-stream" }
            }
            
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        }
        else {
            $response.StatusCode = 404
            $message = "File not found: $localPath"
            $content = [System.Text.Encoding]::UTF8.GetBytes($message)
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        }
        
        $response.Close()
    }
}
finally {
    $listener.Stop()
    Write-Host "Server stopped"
}
