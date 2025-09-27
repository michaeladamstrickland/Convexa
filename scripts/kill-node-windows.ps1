# PowerShell script to reliably kill all Node.js processes on Windows
Write-Host "Stopping all Node.js processes..."

# Get all node processes
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) Node.js process(es)"
    
    # Try graceful termination first
    foreach ($process in $nodeProcesses) {
        try {
            Write-Host "Attempting graceful stop of PID $($process.Id)..."
            $process.CloseMainWindow()
            Start-Sleep -Seconds 2
        } catch {
            Write-Host "Graceful stop failed for PID $($process.Id)"
        }
    }
    
    # Force kill any remaining processes
    Start-Sleep -Seconds 3
    $remainingProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($remainingProcesses) {
        Write-Host "Force killing remaining Node.js processes..."
        foreach ($process in $remainingProcesses) {
            try {
                Stop-Process -Id $process.Id -Force
                Write-Host "Killed PID $($process.Id)"
            } catch {
                Write-Host "Failed to kill PID $($process.Id): $($_.Exception.Message)"
            }
        }
    }
    
    Write-Host "All Node.js processes stopped."
} else {
    Write-Host "No Node.js processes found."
}

# Also kill tsx processes (TypeScript runner)
$tsxProcesses = Get-Process -Name "tsx" -ErrorAction SilentlyContinue
if ($tsxProcesses) {
    Write-Host "Found $($tsxProcesses.Count) tsx process(es), killing..."
    foreach ($process in $tsxProcesses) {
        try {
            Stop-Process -Id $process.Id -Force
            Write-Host "Killed tsx PID $($process.Id)"
        } catch {
            Write-Host "Failed to kill tsx PID $($process.Id): $($_.Exception.Message)"
        }
    }
}

Write-Host "Process cleanup complete."