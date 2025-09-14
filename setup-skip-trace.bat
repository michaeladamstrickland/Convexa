@echo off
REM Skip Trace Database Setup
REM This script applies the schema updates for enhanced skip tracing

echo ------------------------------------------------------
echo              Skip Trace Database Setup
echo ------------------------------------------------------

REM Check if SQLite is installed by trying to run sqlite3 with version flag
sqlite3 --version > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo Error: sqlite3 is required but not installed.
  echo Please install SQLite and add it to your PATH.
  exit /b 1
)

REM Find database file
set DB_PATH=.\prisma\dev.db
if not exist "%DB_PATH%" (
  echo Error: Database file not found at %DB_PATH%
  exit /b 1
)

echo Using database: %DB_PATH%

REM Apply schema updates
echo Applying skip trace schema updates...
sqlite3 "%DB_PATH%" < .\backend\db\skip_trace_schema_update.sql
if %ERRORLEVEL% NEQ 0 (
  echo Error applying schema updates.
  exit /b 1
)

REM Initialize quota for BatchData
for /f "tokens=2 delims==" %%a in ('findstr /I "SKIP_TRACE_DAILY_QUOTA" .env') do set QUOTA=%%a
if "%QUOTA%"=="" set QUOTA=100

echo Initializing quota for BatchData (%QUOTA% lookups per day)...
set TODAY=%date:~10,4%-%date:~4,2%-%date:~7,2%
sqlite3 "%DB_PATH%" "INSERT OR IGNORE INTO provider_quota_usage (provider, date, used, quota) VALUES ('batchdata', '%TODAY%', 0, %QUOTA%);"

echo Setup complete!
echo ------------------------------------------------------
echo           Skip Trace System Ready to Use
echo ------------------------------------------------------
