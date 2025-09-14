#!/bin/bash

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "  ███████ ██      ██ ██████  ████████ ██████   █████   ██████ ██   ██ ███████ ██████  "
echo "  ██      ██      ██ ██   ██    ██    ██   ██ ██   ██ ██      ██  ██  ██      ██   ██ "
echo "  █████   ██      ██ ██████     ██    ██████  ███████ ██      █████   █████   ██████  "
echo "  ██      ██      ██ ██         ██    ██   ██ ██   ██ ██      ██  ██  ██      ██   ██ "
echo "  ██      ███████ ██ ██         ██    ██   ██ ██   ██  ██████ ██   ██ ███████ ██   ██ "
echo "                                                                                      "
echo "  Integration Test Script - ATTOM & Skip Trace API"
echo -e "${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed or not in the PATH.${NC}"
    echo -e "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: No .env file found. Creating a template .env file...${NC}"
    cat > .env << EOL
# Database
DATABASE_URL="file:./dev.db"

# API Keys
ATTOM_API_KEY=your_attom_api_key_here
BATCH_SKIP_TRACING_API_KEY=your_batchdata_api_key_here
WHITEPAGES_PRO_API_KEY=your_whitepages_api_key_here  # Optional

# Feature Flags
FEATURE_ATTOM_PROPERTY_DATA=true
FEATURE_SKIPTRACE_BATCHDATA=true
FEATURE_SKIPTRACE_FALLBACK=true
EOL
    
    echo -e "\nPlease edit the .env file with your API keys before running the tests."
    echo -e "Press Enter to open the .env file in an editor..."
    read -p ""
    
    # Try to open with the default editor
    if command -v nano &> /dev/null; then
        nano .env
    elif command -v vim &> /dev/null; then
        vim .env
    elif command -v vi &> /dev/null; then
        vi .env
    elif command -v gedit &> /dev/null; then
        gedit .env
    else
        echo -e "${YELLOW}Could not find a suitable editor. Please edit the .env file manually.${NC}"
        echo -e "The file is located at: $(pwd)/.env"
    fi
    
    echo -e "\nAfter saving the .env file, run this script again."
    exit 1
fi

# Ensure script is executable
if [ ! -x "run-integration-tests.js" ]; then
    chmod +x run-integration-tests.js
fi

# Run the integration test script
echo -e "${BLUE}Starting integration tests...${NC}"
node run-integration-tests.js
TEST_RESULT=$?

echo ""
if [ $TEST_RESULT -ne 0 ]; then
    echo -e "${RED}Tests completed with errors.${NC}"
else
    echo -e "${GREEN}Tests completed successfully.${NC}"
fi

echo -e "\nFor more detailed testing instructions, see:"
echo -e "- QUICK_START_TESTING.md"
echo -e "- QA_TESTING_INSTRUCTIONS.md"
echo -e "- TECHNICAL_TESTING_GUIDE.md"
echo ""

read -p "Press Enter to continue..."
