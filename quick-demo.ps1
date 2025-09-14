# Quick Demo Launch - PowerShell Version
# For Windows PowerShell users

Write-Host "🚀 LeadFlow AI Master Platform - Quick Demo" -ForegroundColor Green
Write-Host "📊 Superior to PropStream, BatchLeads & REsimpli" -ForegroundColor Cyan
Write-Host "⚡ 26 Premium APIs • AI Analysis • $1.57/search" -ForegroundColor Yellow
Write-Host ""

# Set demo environment
$env:LEADFLOW_TIER = "professional"
$env:DAILY_BUDGET_LIMIT = "150" 
$env:DEMO_PORT = "5001"
$env:NODE_ENV = "development"

Write-Host "📦 Setting up demo environment..." -ForegroundColor Blue

# Navigate to backend and start demo server
Write-Host "🔧 Starting backend demo server..." -ForegroundColor Blue
Set-Location "backend"

# Start backend in new window
Start-Process powershell -ArgumentList "-Command", "npm run dev; Read-Host 'Press Enter to close'"

Write-Host "✅ Backend starting on http://localhost:5001" -ForegroundColor Green
Set-Location ".."

# Wait for backend
Start-Sleep 3

# Navigate to frontend and start React app  
Write-Host "🎨 Starting React frontend..." -ForegroundColor Blue
Set-Location "frontend"

# Start frontend in new window
Start-Process powershell -ArgumentList "-Command", "npm start; Read-Host 'Press Enter to close'"

Write-Host "✅ Frontend starting on http://localhost:3000" -ForegroundColor Green
Set-Location ".."

Start-Sleep 5

Write-Host ""
Write-Host "🎉 LeadFlow AI Platform Demo Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 Backend:  http://localhost:5001" -ForegroundColor Cyan  
Write-Host "❤️  Health:   http://localhost:5001/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Try searching these zip codes:" -ForegroundColor Yellow
Write-Host "   90210 (Beverly Hills)" -ForegroundColor White
Write-Host "   10001 (Manhattan)" -ForegroundColor White
Write-Host "   33101 (Miami Beach)" -ForegroundColor White
Write-Host ""
Write-Host "Features available:" -ForegroundColor Yellow
Write-Host "• Ultimate Search (All 26 APIs)" -ForegroundColor White
Write-Host "• Probate Lead Mining" -ForegroundColor White
Write-Host "• Foreclosure Tracking" -ForegroundColor White
Write-Host "• High Equity Analysis" -ForegroundColor White
Write-Host "• AI-Powered Scoring" -ForegroundColor White
Write-Host "• CSV Export" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Red
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
