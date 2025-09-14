@echo off
echo Adding cost tracking tables...
sqlite3 .\prisma\dev.db < .\prisma\migrations\20230816_add_api_cost_entries.sql

if %errorlevel% neq 0 (
  echo ❌ Failed to add cost tracking tables
  exit /b %errorlevel%
)

echo ✅ Cost tracking tables added successfully

echo Regenerating Prisma client...
npx prisma generate

echo Migration complete! Cost tracking feature is now ready.
