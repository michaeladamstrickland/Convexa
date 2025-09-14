@echo off
REM ATTOM + BatchData Integration Setup Script
REM This script sets up the environment for the ATTOM + BatchData integration

REM Check for required tools
echo Checking for required tools...
where node >nul 2>&1 || (echo Node.js is required but not installed. Aborting. && exit /b 1)
where npm >nul 2>&1 || (echo npm is required but not installed. Aborting. && exit /b 1)

REM Create environment file if it doesn't exist
if not exist .env (
  echo Creating .env file from template...
  copy .env.example .env
  echo Please edit the .env file to add your API keys
)

REM Install dependencies
echo Installing dependencies...
call npm install

REM Run database migration
echo Running database migration...
call npx prisma migrate dev --name attom_batchdata_integration

REM Generate Prisma client
echo Generating Prisma client...
call npx prisma generate

REM Run tests
echo Running tests...
call npm test -- tests/attomBatchIntegration.test.ts

REM Start the server
echo Starting the server...
echo You can access the API at http://localhost:5000
call npm run dev
