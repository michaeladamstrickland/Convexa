#!/bin/bash

# Run the SQL migration script to add cost tracking tables
echo "Adding cost tracking tables..."
sqlite3 ./prisma/dev.db < ./prisma/migrations/20230816_add_api_cost_entries.sql

# Check for errors
if [ $? -eq 0 ]; then
  echo "✅ Cost tracking tables added successfully"
else
  echo "❌ Failed to add cost tracking tables"
  exit 1
fi

# Generate Prisma client with updated schema
echo "Regenerating Prisma client..."
npx prisma generate

echo "Migration complete! Cost tracking feature is now ready."
