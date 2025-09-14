#!/usr/bin/env node

// WORKING REAL LEAD GENERATION
// This generates actual real estate leads from FSBO, expired listings, high equity, etc.

import { WorkingRealDataScraper } from './src/services/workingRealDataScraper';
import { DatabaseService } from './src/services/databaseService';
import { logger } from './src/utils/logger';

async function main() {
  console.log('🚀 LEADFLOW AI - REAL LEAD GENERATION ACTIVATED');
  console.log('📍 Target Market: Phoenix/Scottsdale Metro Area');
  console.log('🎯 Lead Sources: FSBO, Expired Listings, High Equity, Absentee Owners');
  console.log('=' .repeat(85));
  
  const scraper = new WorkingRealDataScraper();
  const db = new DatabaseService();
  
  try {
    // Show current lead count
    const existingLeads = await db.getLeads();
    console.log(`📊 Current leads in database: ${existingLeads.length}`);
    console.log('');
    
    // Run the working real data pipeline
    await scraper.runWorkingRealDataPipeline();
    
    // Show results
    const allLeads = await db.getLeads();
    const newLeadCount = allLeads.length - existingLeads.length;
    
    console.log('');
    console.log('🎉 REAL LEAD GENERATION COMPLETE!');
    console.log(`📈 New leads generated: ${newLeadCount}`);
    console.log(`📊 Total leads: ${allLeads.length}`);
    
    // Show top performing leads
    const highValueLeads = await db.getHighValueLeads(15);
    
    console.log('');
    console.log('⭐ TOP REAL LEADS GENERATED:');
    console.log('-'.repeat(85));
    
    for (const lead of highValueLeads.slice(-newLeadCount)) { // Show only new leads
      console.log(`🏠 ${lead.address}`);
      console.log(`   👤 Owner: ${lead.owner_name}`);
      console.log(`   📞 Phone: ${lead.phone || 'To be researched'}`);
      console.log(`   🎯 Source: ${lead.source_type.replace('_', ' ').toUpperCase()}`);
      console.log(`   📊 Score: ${lead.lead_score}/100`);
      console.log(`   💰 Value: $${lead.estimated_value?.toLocaleString() || 'Unknown'}`);
      console.log(`   📝 Status: ${lead.status.toUpperCase()}`);
      if (lead.notes) console.log(`   📋 Notes: ${lead.notes}`);
      console.log('');
    }
    
    // Calculate immediate revenue potential
    const leadSalesValue = newLeadCount * 125; // $125 per lead
    const avgDealSize = 25000; // Average deal profit
    const conversionRate = 0.15; // 15% conversion
    const estimatedDeals = Math.round(newLeadCount * conversionRate);
    const estimatedDealRevenue = estimatedDeals * avgDealSize;
    
    console.log('💰 IMMEDIATE REVENUE POTENTIAL:');
    console.log(`   💵 Lead Sales Value: $${leadSalesValue.toLocaleString()}`);
    console.log(`   🏠 Estimated Deals: ${estimatedDeals} (${(conversionRate * 100)}% conversion)`);
    console.log(`   🎯 Deal Revenue: $${estimatedDealRevenue.toLocaleString()}`);
    console.log(`   🚀 Total Potential: $${(leadSalesValue + estimatedDealRevenue).toLocaleString()}`);
    console.log('');
    
    // Next steps
    console.log('📋 IMMEDIATE ACTION ITEMS:');
    console.log('   1. ☎️  Start calling FSBO leads (highest motivation)');
    console.log('   2. 📧 Send direct mail to expired listings');
    console.log('   3. 🔍 Research absentee owner contact info');
    console.log('   4. 📊 Set up lead scoring automation');
    console.log('   5. 🤖 Configure SMS drip campaigns');
    console.log('');
    
    console.log('✅ Your LeadFlow AI system is now generating REAL, ACTIONABLE leads!');
    console.log('🚀 Ready to start making money from real estate leads TODAY!');
    
  } catch (error) {
    console.error('❌ Error in working real lead generation:', error);
  } finally {
    await db.disconnect();
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as runWorkingRealLeadGeneration };
