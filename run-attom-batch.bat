@echo off
REM ATTOM Batch Processor Runner
REM This batch file helps run the ATTOM batch processing commands

echo =======================================
echo Convexa AI - ATTOM Batch Processor
echo =======================================
echo.

IF "%1"=="" (
  echo Usage: run-attom-batch [command] [arguments]
  echo.
  echo Available commands:
  echo   submit [csv-file] [--name NAME]    - Submit a new batch
  echo   status [batch-id]                  - Check batch status
  echo   download [batch-id]                - Download batch results
  echo   process [batch-id] [--leads]       - Process batch results
  echo   list                               - List all batches
  echo   run-all [csv-file] [--name NAME]   - Run full batch process
  echo.
  echo Example: run-attom-batch submit data\attom_batch\properties.csv --name "Test Batch"
  exit /b 1
)

REM Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo Error: Node.js is not installed or not in the PATH
  echo Please install Node.js and try again
  exit /b 1
)

REM Create directories if they don't exist
IF NOT EXIST "data\attom_batch\uploads" (
  mkdir data\attom_batch\uploads
  echo Created uploads directory
)

IF NOT EXIST "data\attom_batch\results" (
  mkdir data\attom_batch\results
  echo Created results directory
)

IF NOT EXIST "logs" (
  mkdir logs
  echo Created logs directory
)

REM Run the command
cd backend\src
echo Running: node attom-batch.js %*
node attom-batch.js %*
cd ..\..
