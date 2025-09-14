#!/bin/bash

# LeadFlow AI Master Platform - Full System Startup Script
# Starts both backend demo server and React frontend

echo "🚀 Starting LeadFlow AI Master Platform..."
echo "📊 Superior to PropStream, BatchLeads & REsimpli"
echo "⚡ 26 Premium APIs • AI-Powered Analysis • $1.57/search"
echo ""

# Set environment variables for demo
export LEADFLOW_TIER=professional
export DAILY_BUDGET_LIMIT=150
export DEMO_PORT=5001
export NODE_ENV=development

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if node_modules exist
check_dependencies() {
    echo -e "${BLUE}📦 Checking dependencies...${NC}"
    
    # Check backend dependencies
    cd backend
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing backend dependencies...${NC}"
        npm install
    fi
    cd ..
    
    # Check frontend dependencies  
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        npm install
        
        # Install additional dependencies for our demo
        npm install lucide-react axios
        
        # Install Tailwind CSS if not present
        npm install -D tailwindcss postcss autoprefixer @tailwindcss/forms
        npx tailwindcss init -p
    fi
    cd ..
}

# Start backend demo server
start_backend() {
    echo -e "${BLUE}🔧 Starting Backend Demo Server...${NC}"
    cd backend
    
    # Compile TypeScript if needed
    if [ ! -d "dist" ]; then
        echo -e "${YELLOW}Compiling TypeScript...${NC}"
        npx tsc src/demoServer.ts --outDir dist --moduleResolution node --target es2020 --lib es2020 --esModuleInterop --allowSyntheticDefaultImports
    fi
    
    # Start demo server in background
    npm run dev &
    BACKEND_PID=$!
    
    echo -e "${GREEN}✅ Backend running on http://localhost:5001${NC}"
    cd ..
    
    # Wait for backend to start
    sleep 3
}

# Start frontend React app
start_frontend() {
    echo -e "${BLUE}🎨 Starting React Frontend...${NC}"
    cd frontend
    
    # Start React app
    npm start &
    FRONTEND_PID=$!
    
    echo -e "${GREEN}✅ Frontend will start on http://localhost:3000${NC}"
    cd ..
    
    # Wait for frontend to start
    sleep 5
}

# Cleanup function
cleanup() {
    echo -e "${RED}🛑 Shutting down LeadFlow AI Platform...${NC}"
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "${YELLOW}Backend server stopped${NC}"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo -e "${YELLOW}Frontend server stopped${NC}"
    fi
    
    # Kill any remaining processes on our ports
    lsof -ti:5001 | xargs kill -9 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    
    echo -e "${GREEN}✅ LeadFlow AI Platform shutdown complete${NC}"
    exit 0
}

# Set trap to cleanup on exit
trap cleanup INT TERM EXIT

# Main execution
main() {
    echo -e "${GREEN}🎯 Initializing LeadFlow AI Master Platform...${NC}"
    
    # Check and install dependencies
    check_dependencies
    
    # Start backend first
    start_backend
    
    # Start frontend
    start_frontend
    
    echo ""
    echo -e "${GREEN}🎉 LeadFlow AI Master Platform is now running!${NC}"
    echo ""
    echo -e "${BLUE}📱 Frontend (React):${NC} http://localhost:3000"
    echo -e "${BLUE}🔧 Backend (API):${NC} http://localhost:5001"
    echo -e "${BLUE}❤️  Health Check:${NC} http://localhost:5001/health"
    echo -e "${BLUE}📊 System Status:${NC} http://localhost:5001/api/system/status"
    echo ""
    echo -e "${YELLOW}🎯 Features Available:${NC}"
    echo "  • Ultimate Search (All 26 APIs)"
    echo "  • Probate Lead Mining"  
    echo "  • Foreclosure Tracking"
    echo "  • High Equity Analysis"
    echo "  • AI-Powered Scoring"
    echo "  • Contact Information"
    echo "  • CSV Export"
    echo ""
    echo -e "${GREEN}Superior to PropStream/BatchLeads/REsimpli with 26 data sources!${NC}"
    echo ""
    echo -e "${RED}Press Ctrl+C to stop all services${NC}"
    
    # Keep script running
    wait
}

# Run main function
main
