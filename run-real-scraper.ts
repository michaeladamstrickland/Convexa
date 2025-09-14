#!/usr/bin/env node

// REAL LEAD GENERATION PIPELINE
// This script connects to actual public data sources and generates real leads

import { RealDataScraper } from './src/services/realDataScraper';
import { DatabaseService } from './src/services/databaseService';
import { logger } from './src/utils/logger';

async function main() {
  console.log('🚀 STARTING REAL LEAD GENERATION PIPELINE');
  console.log('📍 Target: Phoenix/Scottsdale Area');
  console.log('🎯 Sources: Probate Courts, Code Enforcement, Tax Records, Foreclosures');
  console.log('=' .repeat(80));
  
  const scraper = new RealDataScraper();
  const db = new DatabaseService();
  
  try {
    // Show current lead count
    const existingLeads = await db.getLeads();
    console.log(`📊 Current leads in database: ${existingLeads.length}`);
    console.log('');
    
    // Run the complete real data pipeline
    await scraper.runCompleteRealDataPipeline();
    
    // Show results
    const newLeads = await db.getLeads();
    const newLeadCount = newLeads.length - existingLeads.length;
    
    console.log('');
    console.log('🎉 REAL LEAD GENERATION COMPLETE!');
    console.log(`📈 New leads generated: ${newLeadCount}`);
    console.log(`📊 Total leads: ${newLeads.length}`);
    
    // Show top performing leads
    const highValueLeads = await db.getHighValueLeads(10);
    
    console.log('');
    console.log('⭐ TOP REAL LEADS GENERATED:');
    console.log('-'.repeat(80));
    
    for (const lead of highValueLeads.slice(0, 5)) {
      console.log(`🏠 ${lead.address}`);
      console.log(`   Owner: ${lead.owner_name}`);
      console.log(`   Source: ${lead.source_type}`);
      console.log(`   Score: ${lead.lead_score}/100`);
      console.log(`   Value: $${lead.estimated_value?.toLocaleString() || 'Unknown'}`);
      console.log(`   Status: ${lead.status}`);
      if (lead.notes) console.log(`   Notes: ${lead.notes}`);
      console.log('');
    }
    
    // Calculate value
    const totalValue = newLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    const leadSalesValue = newLeadCount * 125; // $125 per lead
    
    console.log('💰 REVENUE POTENTIAL:');
    console.log(`   💵 Lead Sales Value: $${leadSalesValue.toLocaleString()}`);
    console.log(`   🏠 Property Value: $${totalValue.toLocaleString()}`);
    console.log(`   🎯 Est. Deal Revenue: $${(totalValue * 0.1).toLocaleString()} (10% capture)`);
    console.log('');
    
    console.log('✅ Real data scraping pipeline completed successfully!');
    console.log('🚀 Your LeadFlow AI system is now generating REAL leads!');
    
  } catch (error) {
    console.error('❌ Error in real lead generation pipeline:', error);
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

export { main as runRealLeadGeneration };
