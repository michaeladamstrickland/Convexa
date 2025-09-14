#!/bin/bash

# ATTOM + BatchData Integration Setup Script
# This script sets up the environment for the ATTOM + BatchData integration

# Check for required tools
echo "Checking for required tools..."
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting."; exit 1; }

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file from template..."
  cp .env.example .env
  echo "Please edit the .env file to add your API keys"
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Run database migration
echo "Running database migration..."
npx prisma migrate dev --name attom_batchdata_integration

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run tests
echo "Running tests..."
npm test -- tests/attomBatchIntegration.test.ts

# Start the server
echo "Starting the server..."
echo "You can access the API at http://localhost:5000"
npm run dev
