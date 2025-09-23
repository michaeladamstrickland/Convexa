#!/bin/bash

# Ensure the backups directory exists
mkdir -p /data/backups

# Get current date in YYYY-MM-DD format
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_FILE="/data/backups/${BACKUP_DATE}.zip"

# Create the zip archive
zip -r "$BACKUP_FILE" /data/convexa.db /data/run_storage

echo "Backup created: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
