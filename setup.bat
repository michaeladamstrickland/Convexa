@echo off
echo 🚀 LEADFLOW AI - REAL DATA SETUP
echo ================================

cd /d "c:\Users\stric\Downloads\Flip Tracker\flip_tracker_full\leadflow_ai"

echo 📦 Installing dependencies...
call npm install

echo 🗄️ Setting up database...
call npx prisma generate
call npx prisma migrate dev --name init

echo 🌱 Seeding database...
call npx tsx prisma/seed.ts

echo ✅ Setup complete!
echo.
echo 🎯 NEXT STEPS:
echo ==============
echo 1. Start real server: npm run real-server
echo 2. Test at: http://localhost:3001/health
echo 3. Generate leads: POST http://localhost:3001/pipeline/run
echo.
echo 💰 Ready to make REAL MONEY!
pause
