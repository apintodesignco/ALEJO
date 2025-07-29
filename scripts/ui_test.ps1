# Automated UI Test Script

# Wait for server to start
Start-Sleep -Seconds 5

# Test homepage
$response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
if ($response.StatusCode -ne 200) {
    throw "Homepage failed with status $($response.StatusCode)"
}

# Test API endpoints
$endpoints = @("/api/health", "/api/version", "/api/config")
foreach ($endpoint in $endpoints) {
    $apiResponse = Invoke-WebRequest -Uri "http://localhost:3000$endpoint" -UseBasicParsing
    if ($apiResponse.StatusCode -ne 200) {
        throw "API endpoint $endpoint failed with status $($apiResponse.StatusCode)"
    }
}

# Test WebSocket connection
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cancellation = New-Object System.Threading.CancellationToken
$connection = $ws.ConnectAsync("ws://localhost:3000/ws", $cancellation)
$connection.Wait(5000)
if (-not $connection.IsCompleted) {
    throw "WebSocket connection timed out"
}

Write-Host "✅ All UI tests passed" -ForegroundColor Green
