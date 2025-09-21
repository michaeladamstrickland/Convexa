@echo off
set DB_PATH=backend/data/convexa_sixth.db
set PORT=6027
set PROVIDER_STUB=true
set SKIP_TRACE_DAILY_BUDGET_USD=0.01
set SKIP_TRACE_RPS=1
set SKIP_TRACE_CONCURRENCY=1
start /B node backend/integrated-server.js
echo %PID% > server_pid.txt
 