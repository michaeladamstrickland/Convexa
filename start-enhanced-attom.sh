#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting FlipTracker with Enhanced ATTOM Data Integration${NC}"
echo -e "${YELLOW}=====================================================${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the root project directory${NC}"
    exit 1
fi

# Function to check if a port is in use
port_in_use() {
  netstat -aon | grep -q ":$1 "
  return $?
}

# Check for existing processes on our ports
if port_in_use 5001; then
    echo -e "${YELLOW}Warning: Port 5001 is already in use${NC}"
    echo "Do you want to kill the process using port 5001? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        # Find and kill process on port 5001
        if command -v taskkill &> /dev/null; then
            # Windows
            for /f "tokens=5" %a in ('netstat -ano ^| find ":5001"') do taskkill /F /PID %a
        else
            # Unix-like
            kill $(lsof -t -i:5001) 2>/dev/null
        fi
        echo -e "${GREEN}Process killed${NC}"
    fi
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Check for environment variables
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found, creating a default one${NC}"
    cp .env.example .env 2>/dev/null || echo "Failed to create .env file"
fi

# Check for API keys
if ! grep -q "ATTOM_API_KEY=" .env || grep -q "ATTOM_API_KEY=your_attom_api_key" .env; then
    echo -e "${YELLOW}Warning: ATTOM_API_KEY not found or not set in .env file${NC}"
    echo -e "Please set your ATTOM API key in the .env file"
fi

# Start the ATTOM API server
echo -e "${BLUE}Starting ATTOM API Server...${NC}"

# Change to backend directory
cd backend || { echo -e "${RED}Error: backend directory not found${NC}"; exit 1; }

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    npm install
fi

# Run the server
echo -e "${GREEN}Starting ATTOM API Server on port 5001${NC}"
echo -e "${BLUE}This server provides enriched property data including:${NC}"
echo -e " - Full property details"
echo -e " - Owner information"
echo -e " - Valuation data"
echo -e " - Tax history"
echo -e " - Sales history"

# Start the server
node attom-server.js &
ATTOM_SERVER_PID=$!

# Change back to root directory
cd ..

# Start the frontend development server
echo -e "${BLUE}Starting frontend development server...${NC}"
cd frontend || { echo -e "${RED}Error: frontend directory not found${NC}"; exit 1; }

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

# Start the frontend
echo -e "${GREEN}Starting frontend development server${NC}"
npm start

# Cleanup function
cleanup() {
    echo -e "${BLUE}Shutting down servers...${NC}"
    kill $ATTOM_SERVER_PID 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
}

# Set up trap for cleanup
trap cleanup EXIT

# Wait for processes to complete
wait
