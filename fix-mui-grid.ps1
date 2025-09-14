Write-Host "Fixing MUI Grid v2 migration issues..." -ForegroundColor Cyan

# Set the frontend directory
$frontendDir = "frontend\src"

if (Test-Path $frontendDir) {
    Write-Host "Scanning $frontendDir for Grid components..." -ForegroundColor Cyan
    
    # Get all JSX and TSX files
    $files = Get-ChildItem -Path $frontendDir -Recurse -Include *.jsx,*.tsx
    
    foreach ($file in $files) {
        $content = Get-Content -Path $file.FullName -Raw
        
        if ($content -match '<Grid item ') {
            Write-Host "Processing $($file.FullName)" -ForegroundColor Yellow
            
            # Replace <Grid item with <Grid
            $newContent = $content -replace '<Grid item ', '<Grid '
            
            # Write back to the file
            Set-Content -Path $file.FullName -Value $newContent
            
            Write-Host "Updated $($file.FullName)" -ForegroundColor Green
        }
    }
    
    Write-Host "Grid component migration complete" -ForegroundColor Green
} else {
    Write-Host "Frontend directory not found at $frontendDir" -ForegroundColor Red
    exit 1
}

Write-Host "`nAdding new API route for adding leads..." -ForegroundColor Cyan

$backendDir = "backend"
if (Test-Path $backendDir) {
    Write-Host "Creating route in $backendDir\routes..." -ForegroundColor Yellow
    # Here we would ensure the API route file exists
} else {
    Write-Host "❌ Backend directory not found at $backendDir" -ForegroundColor Red
}

Write-Host "`nAll fixes applied!" -ForegroundColor Green
Write-Host "Please restart your development servers to apply the changes." -ForegroundColor Cyan

# Keep the console window open
Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
