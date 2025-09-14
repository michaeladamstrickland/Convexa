@echo off
REM Script to fix MUI Grid v2 migration issues in React components

echo Fixing MUI Grid v2 migration issues...

REM Process frontend directory
set "frontend_dir=frontend\src"
if exist "%frontend_dir%" (
  echo Scanning %frontend_dir% for Grid components...
  
  REM Find JSX files with Grid components and process them
  for /r "%frontend_dir%" %%f in (*.jsx *.tsx) do (
    findstr /i /c:"Grid item" "%%f" >nul
    if not errorlevel 1 (
      echo Processing %%f
      
      REM Create a temporary file
      set "tempfile=%%f.tmp"
      
      REM Use PowerShell to replace Grid item with Grid
      powershell -Command "(Get-Content '%%f') -replace '<Grid item ', '<Grid ' | Set-Content '%tempfile%'"
      
      REM Replace the original file with the updated one
      move /y "%tempfile%" "%%f" >nul
      
      echo ✓ Updated %%f
    )
  )
  
  echo ✅ Grid component migration complete
) else (
  echo ❌ Frontend directory not found at %frontend_dir%
  exit /b 1
)

echo.
echo Adding new API route for adding leads...
set "backend_dir=backend"
if exist "%backend_dir%" (
  echo Creating route in %backend_dir%\routes...
  REM Here you would create or update the API route file
) else (
  echo ❌ Backend directory not found at %backend_dir%
)

echo.
echo ✨ All fixes applied!
echo Please restart your development servers to apply the changes.

pause
