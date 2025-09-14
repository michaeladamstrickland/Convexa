#!/usr/bin/env node

// ZIP CODE LEAD SEARCH TOOL
// Search specific zip codes for real estate leads

import { ZipCodeLeadGenerator } from './src/services/zipCodeLeadGenerator';
import { DatabaseService } from './src/services/databaseService';

async function main() {
  const args = process.argv.slice(2);
  const generator = new ZipCodeLeadGenerator();
  const db = new DatabaseService();

  try {
    if (args.length === 0) {
      console.log('🔍 ZIP CODE LEAD SEARCH TOOL');
      console.log('=' .repeat(40));
      console.log('Usage:');
      console.log('  npx tsx zip-search.ts 85251                    # Search specific zip');
      console.log('  npx tsx zip-search.ts 85251 85254 85260        # Search multiple zips');
      console.log('  npx tsx zip-search.ts area                     # Search all target area');
      console.log('  npx tsx zip-search.ts summary                  # Show leads by zip');
      console.log('');
      console.log('🎯 TARGET AREA ZIP CODES:');
      console.log('   Phoenix: 85001, 85003, 85008, 85018, 85032...');
      console.log('   Scottsdale: 85251, 85254, 85257, 85260...');
      console.log('   Tempe: 85281, 85283...');
      console.log('   Mesa: 85201, 85203, 85206...');
      return;
    }

    if (args[0] === 'summary') {
      await generator.getLeadsByZipCode();
      return;
    }

    if (args[0] === 'area') {
      console.log('🎯 SEARCHING ENTIRE TARGET AREA');
      await generator.searchTargetArea();
      
      // Show results
      const leads = await db.getLeads();
      console.log('\n📊 SEARCH RESULTS:');
      console.log(`   Total Leads: ${leads.length}`);
      console.log(`   Revenue Potential: $${(leads.length * 125).toLocaleString()}`);
      return;
    }

    // Search specific zip codes
    const zipCodes = args.filter(arg => /^\d{5}$/.test(arg));
    
    if (zipCodes.length === 0) {
      console.log('❌ Please provide valid 5-digit zip codes');
      return;
    }

    console.log('🔍 SEARCHING SPECIFIC ZIP CODES');
    console.log(`📍 Zip Codes: ${zipCodes.join(', ')}`);
    console.log('=' .repeat(50));

    let totalNewLeads = 0;
    const startTime = Date.now();

    for (const zipCode of zipCodes) {
      console.log(`\n🔍 Searching ZIP: ${zipCode}`);
      
      const leads = await generator.searchZipCode(zipCode);
      
      console.log(`   📊 Found ${leads.length} leads in ${zipCode}`);
      
      // Save to database
      for (const lead of leads) {
        const existing = await db.getLeadByAddress(lead.address);
        if (!existing) {
          await db.createLead({
            address: lead.address,
            owner_name: lead.owner,
            phone: lead.phone,
            source_type: lead.leadType,
            estimated_value: lead.propertyValue,
            motivation_score: lead.distressScore,
            notes: `ZIP: ${lead.zipCode} | ${lead.notes}`
          });
          totalNewLeads++;
        }
      }
      
      // Show sample leads
      if (leads.length > 0) {
        console.log('   📋 Sample Leads:');
        for (const lead of leads.slice(0, 2)) {
          console.log(`      🏠 ${lead.address}`);
          console.log(`         👤 ${lead.owner} ${lead.phone ? '📞 ' + lead.phone : ''}`);
          console.log(`         💰 $${lead.propertyValue.toLocaleString()} | 🎯 ${lead.leadType}`);
          console.log(`         📝 ${lead.motivation}`);
        }
        if (leads.length > 2) {
          console.log(`      ... and ${leads.length - 2} more leads`);
        }
      }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n🎉 ZIP CODE SEARCH COMPLETE!');
    console.log(`📊 New Leads Added: ${totalNewLeads}`);
    console.log(`⏱️ Search Duration: ${duration} seconds`);
    console.log(`💰 Revenue Potential: $${(totalNewLeads * 125).toLocaleString()}`);

    // Show all leads now
    const allLeads = await db.getLeads();
    console.log(`📈 Total Leads in Database: ${allLeads.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.disconnect();
  }
}

main().catch(console.error);
