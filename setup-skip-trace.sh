#!/bin/bash

# Skip Trace Database Setup
# This script applies the schema updates for enhanced skip tracing

# Terminal colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              ${GREEN}Skip Trace Database Setup${BLUE}                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# Check if SQLite is installed
if ! command -v sqlite3 &> /dev/null; then
  echo -e "${RED}Error: sqlite3 is required but not installed.${NC}"
  echo "Please install SQLite and try again."
  exit 1
fi

# Find database file
DB_PATH="./prisma/dev.db"

if [ ! -f "$DB_PATH" ]; then
  echo -e "${RED}Error: Database file not found at $DB_PATH${NC}"
  exit 1
fi

echo -e "${YELLOW}Using database: $DB_PATH${NC}"

# Apply schema updates
echo -e "${YELLOW}Applying skip trace schema updates...${NC}"
sqlite3 "$DB_PATH" < ./backend/db/skip_trace_schema_update.sql

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Schema updates applied successfully!${NC}"
else
  echo -e "${RED}Error applying schema updates.${NC}"
  exit 1
fi

# Initialize quota for BatchData
TODAY=$(date +%Y-%m-%d)
QUOTA=$(grep SKIP_TRACE_DAILY_QUOTA .env | cut -d '=' -f2)

if [ -z "$QUOTA" ]; then
  QUOTA=100
fi

echo -e "${YELLOW}Initializing quota for BatchData ($QUOTA lookups per day)...${NC}"
sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO provider_quota_usage (provider, date, used, quota) VALUES ('batchdata', '$TODAY', 0, $QUOTA);"

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            ${GREEN}Skip Trace System Ready to Use${BLUE}              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
