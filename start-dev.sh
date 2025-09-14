#!/bin/bash

# Start the integrated server and frontend in development mode
# This script starts both the backend API and the frontend React app

# Terminal colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 ${GREEN}FlipTracker Startup Script${BLUE}               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# Check if running on Windows with Git Bash
if [[ "$OSTYPE" == "msys" ]]; then
  echo -e "${YELLOW}Running on Windows with Git Bash${NC}"
  BACKEND_CMD="node backend/integrated-server.js"
  FRONTEND_CMD="cd frontend && npm run dev"
else
  # For Linux/Mac
  echo -e "${YELLOW}Running on Linux/Mac${NC}"
  BACKEND_CMD="node backend/integrated-server.js"
  FRONTEND_CMD="cd frontend && npm run dev"
fi

# Check for required tools
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js is required but not installed.${NC}"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is required but not installed.${NC}"
  exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}Warning: .env file not found. Creating a sample one...${NC}"
  echo "# FlipTracker Environment Variables
PORT=5001
NODE_ENV=development

# ATTOM API Configuration
ATTOM_API_KEY=your_attom_api_key_here
ATTOM_API_ENDPOINT=https://api.gateway.attomdata.com/propertyapi/v1.0.0

# BatchData (using their documented endpoint)
BATCHDATA_API_KEY=your_batchdata_api_key_here
BATCHDATA_API_URL=https://api.batchdata.com/api
SKIP_TRACE_DAILY_QUOTA=100

# Database Configuration
DATABASE_URL=./prisma/dev.db
" > .env
  echo -e "${GREEN}Sample .env file created. Please edit with your actual API keys.${NC}"
fi

# Start the backend server
echo -e "\n${YELLOW}Starting backend server...${NC}"
echo -e "${BLUE}Command: ${BACKEND_CMD}${NC}"
$BACKEND_CMD &
BACKEND_PID=$!

# Wait a moment to let the backend start
sleep 2

# Check if backend started successfully
if ! ps -p $BACKEND_PID > /dev/null; then
  echo -e "${RED}Error: Backend server failed to start.${NC}"
  exit 1
fi

echo -e "${GREEN}Backend server started with PID: ${BACKEND_PID}${NC}"

# Start the frontend development server
echo -e "\n${YELLOW}Starting frontend development server...${NC}"
echo -e "${BLUE}Command: ${FRONTEND_CMD}${NC}"
$FRONTEND_CMD &
FRONTEND_PID=$!

# Wait a moment to let the frontend start
sleep 2

# Check if frontend started successfully
if ! ps -p $FRONTEND_PID > /dev/null; then
  echo -e "${RED}Error: Frontend server failed to start.${NC}"
  kill $BACKEND_PID
  exit 1
fi

echo -e "${GREEN}Frontend server started with PID: ${FRONTEND_PID}${NC}"

echo -e "\n${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}FlipTracker is running!${NC}"
echo -e "${YELLOW}Backend:${NC} http://localhost:5001"
echo -e "${YELLOW}Frontend:${NC} http://localhost:3000"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "Press Ctrl+C to stop both servers\n"

# Handle cleanup on exit
trap "echo -e '\n${YELLOW}Stopping servers...${NC}'; kill $BACKEND_PID $FRONTEND_PID; echo -e '${GREEN}Servers stopped${NC}'; exit 0" INT TERM

# Keep the script running
wait
