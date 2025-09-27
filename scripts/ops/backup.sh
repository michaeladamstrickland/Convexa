#!/bin/bash

# Ensure the backups directory exists within the project
BACKUP_ROOT="./backups"
mkdir -p "$BACKUP_ROOT"

# Get current date in YYYY-MM-DD format
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_DATE}"
mkdir -p "$BACKUP_DIR"

# Back up SQLite database
# Assuming the database file is at ./db/convexa.db
if [ -f "./db/convexa.db" ]; then
  gzip -c "./db/convexa.db" > "${BACKUP_DIR}/db.sqlite.gz"
  echo "Database backup created: ${BACKUP_DIR}/db.sqlite.gz"
else
  echo "Warning: Database file ./db/convexa.db not found. Skipping database backup."
fi

# Back up STORAGE_ROOT artifacts
# Assuming artifacts are in the ./artifacts directory
if [ -d "./artifacts" ]; then
  tar -czf "${BACKUP_DIR}/artifacts.tar.gz" -C . artifacts
  echo "Artifacts backup created: ${BACKUP_DIR}/artifacts.tar.gz"
else
  echo "Warning: Artifacts directory ./artifacts not found. Skipping artifacts backup."
fi

# List contents of the newly created backup directory for verification
echo "Contents of new backup directory:"
ls -R "$BACKUP_DIR"

# Prune backups older than 7 days
find "$BACKUP_ROOT" -type d -mtime +7 -exec rm -rf {} \;
echo "Old backups pruned."
