@echo off
REM Batch script to reliably stop Node.js processes on Windows
echo Stopping Node.js processes...

REM Kill node processes
taskkill /IM "node.exe" /F >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js processes stopped.
) else (
    echo No Node.js processes found or already stopped.
)

REM Kill tsx processes
taskkill /IM "tsx.exe" /F >nul 2>&1
if %errorlevel% equ 0 (
    echo TSX processes stopped.
) else (
    echo No TSX processes found or already stopped.
)

echo Process cleanup complete.