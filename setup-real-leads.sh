#!/bin/bash

echo "🚀 SETTING UP LEADFLOW AI - REAL LEAD GENERATION"
echo "================================================"

# Navigate to the LeadFlow AI directory
cd "c:/Users/stric/Downloads/Flip Tracker/flip_tracker_full/leadflow_ai"

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Setting up database..."
npx prisma generate
npx prisma migrate dev --name init

echo "🌱 Seeding database with sample data..."
npx tsx prisma/seed.ts

echo "✅ Setup complete!"
echo ""
echo "🎯 NEXT STEPS:"
echo "=============="
echo "1. Start the real data server:"
echo "   npm run real-server"
echo ""
echo "2. Test the API endpoints:"
echo "   http://localhost:3001/health"
echo "   http://localhost:3001/leads"
echo "   http://localhost:3001/revenue"
echo ""
echo "3. Run the lead generation pipeline:"
echo "   POST http://localhost:3001/pipeline/run"
echo ""
echo "💰 Ready to generate REAL LEADS and REAL MONEY!"
