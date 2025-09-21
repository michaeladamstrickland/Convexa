$port = 6027
$process = (netstat -ano | Select-String ":$port" | ForEach-Object { $_.ToString().Split() | Select-Object -Last 1 })
if ($process) {
    $pid = $process | Select-Object -First 1
    Write-Host "Attempting to kill process with PID: $pid on port $port"
    taskkill /PID $pid /F
} else {
    Write-Host "No process found listening on port $port"
}
