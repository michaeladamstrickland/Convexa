#!/usr/bin/env node

// Convexa AI Master Setup Script
// Step 1 of getting your comprehensive real estate platform operational

const fs = require('fs');
const path = require('path');

console.log('🏗️  Convexa AI Master Setup');
console.log('============================\n');

// Step 1: Copy environment template
console.log('1️⃣ Setting up environment configuration...');

const envExamplePath = path.join(__dirname, '..', '.env.example');
const envPath = path.join(__dirname, '..', '.env');

try {
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('   ✅ Created .env file from template');
  } else {
    console.log('   ℹ️  .env file already exists');
  }
} catch (error) {
  console.log('   ❌ Failed to create .env file:', error.message);
}

// Step 2: Display next steps
console.log('\n2️⃣ Configuration Guide:');
console.log('   📝 Edit your .env file with your API keys:');
console.log('   • Choose your tier: starter, professional, or enterprise');
console.log('   • Add API keys for the services you want to use');
console.log('   • Set your daily budget limit');

console.log('\n3️⃣ Quick Start Options:');
console.log('');
console.log('   🚀 STARTER TIER ($500-800/month):');
console.log('   • ATTOM_DATA_API_KEY - Property data');
console.log('   • BATCH_SKIP_TRACING_API_KEY - Contact info');
console.log('   • OPENAI_API_KEY - AI analysis');
console.log('   • Set LEADFLOW_TIER=starter');
console.log('');
console.log('   💪 PROFESSIONAL TIER ($1500-2500/month):');
console.log('   • All Starter APIs plus:');
console.log('   • MLS_GRID_API_KEY - MLS data');
console.log('   • PROPERTY_RADAR_API_KEY - Foreclosures');
console.log('   • US_OBITUARY_API_KEY - Probate leads');
console.log('   • Set LEADFLOW_TIER=professional');
console.log('');
console.log('   🏆 ENTERPRISE TIER ($3000-5000/month):');
console.log('   • All Professional APIs plus:');
console.log('   • IDI_DATA_LEXISNEXIS_API_KEY - Premium contacts');
console.log('   • PEOPLE_DATA_LABS_API_KEY - Enhanced enrichment');
console.log('   • All 24+ premium data sources');
console.log('   • Set LEADFLOW_TIER=enterprise');

console.log('\n4️⃣ Test Your Setup:');
console.log('   npm run test:config     # Test configuration');
console.log('   npm run start:master    # Start with master config');
console.log('   npm run dev            # Start in development mode');

console.log('\n5️⃣ API Key Resources:');
console.log('   🔗 ATTOM Data: https://api.developer.attomdata.com/');
console.log('   🔗 Batch Skip Tracing: https://batchskiptracing.com/api');
console.log('   🔗 OpenAI: https://platform.openai.com/');
console.log('   🔗 MLS Grid: https://mlsgrid.com/');
console.log('   🔗 Property Radar: https://propertyradar.com/api');
console.log('   🔗 Complete list in: MASTER_SETUP_GUIDE.md');

console.log('\n💡 Cost Estimates:');
console.log('   Starter: ~$2-4 per property search');
console.log('   Professional: ~$4-8 per property search');
console.log('   Enterprise: ~$8-15 per property search');
console.log('   (Higher cost = more data sources + better leads)');

console.log('\n🎯 Ready to dominate real estate lead generation!');
console.log('   Edit .env → Add API keys → npm run start:master');
console.log('');

// Step 3: Create package.json scripts if needed
const packageJsonPath = path.join(__dirname, '..', 'package.json');
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (!packageJson.scripts['test:config']) {
    packageJson.scripts['test:config'] = 'tsx src/tests/masterConfigTest.ts';
    packageJson.scripts['start:master'] = 'tsx src/server-master.ts';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('📦 Added npm scripts for master configuration');
  }
} catch (error) {
  console.log('⚠️  Could not update package.json scripts');
}
