#!/usr/bin/env node

// ZIP CODE LEAD DASHBOARD
// Organized view of leads by zip code for calling

import { DatabaseService } from './src/services/databaseService';

async function showZipCodeDashboard() {
  const db = new DatabaseService();
  
  try {
    const leads = await db.getLeads();
    
    console.log('📍 ZIP CODE LEAD DASHBOARD - YOUR TARGET MARKET');
    console.log('=' .repeat(70));
    
    // Group leads by zip code
    const zipGroups: Record<string, any[]> = {};
    
    leads.forEach(lead => {
      const zipMatch = lead.address.match(/\b(\d{5})\b/);
      const zip = zipMatch ? zipMatch[1] : 'Unknown';
      
      if (!zipGroups[zip]) {
        zipGroups[zip] = [];
      }
      zipGroups[zip].push(lead);
    });
    
    // Sort zip codes by lead count
    const sortedZips = Object.entries(zipGroups)
      .sort((a, b) => b[1].length - a[1].length);
    
    let totalValue = 0;
    let callableLeads = 0;
    
    for (const [zip, zipLeads] of sortedZips) {
      const cityName = getCityFromZip(zip);
      const avgValue = zipLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0) / zipLeads.length;
      const avgScore = zipLeads.reduce((sum, lead) => sum + (lead.lead_score || 0), 0) / zipLeads.length;
      const withPhone = zipLeads.filter(lead => lead.phone && lead.phone !== 'Need skip trace').length;
      
      totalValue += zipLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
      callableLeads += withPhone;
      
      console.log(`\n📮 ZIP ${zip} - ${cityName}`);
      console.log(`📊 ${zipLeads.length} leads | 📞 ${withPhone} callable | 💰 Avg: $${avgValue.toLocaleString()} | 📈 Score: ${avgScore.toFixed(1)}`);
      console.log('-'.repeat(50));
      
      // Show top leads in this zip
      const topLeads = zipLeads
        .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
        .slice(0, 3);
      
      for (const lead of topLeads) {
        const phoneDisplay = lead.phone && lead.phone !== 'Need skip trace' 
          ? `📞 ${lead.phone}` 
          : '🔍 Skip trace needed';
        
        console.log(`🏠 ${lead.address}`);
        console.log(`   👤 ${lead.owner_name} | ${phoneDisplay}`);
        console.log(`   💰 $${(lead.estimated_value || 0).toLocaleString()} | 📊 ${lead.lead_score}/100 | 🎯 ${lead.source_type}`);
        if (lead.notes) console.log(`   📝 ${lead.notes.substring(0, 80)}...`);
        console.log('');
      }
      
      if (zipLeads.length > 3) {
        console.log(`   ... and ${zipLeads.length - 3} more leads in this zip\n`);
      }
    }
    
    // Summary stats
    console.log('💰 MARKET SUMMARY');
    console.log('=' .repeat(40));
    console.log(`📊 Total Leads: ${leads.length}`);
    console.log(`📞 Ready to Call: ${callableLeads}`);
    console.log(`💵 Total Property Value: $${totalValue.toLocaleString()}`);
    console.log(`🎯 Lead Sales Value: $${(leads.length * 125).toLocaleString()}`);
    console.log(`🏆 Deal Potential: $${Math.round(leads.length * 0.15 * 25000).toLocaleString()}`);
    
    // Top zip codes to focus on
    console.log('\n🎯 TOP ZIP CODES TO FOCUS ON:');
    for (const [zip, zipLeads] of sortedZips.slice(0, 5)) {
      const cityName = getCityFromZip(zip);
      const callableCount = zipLeads.filter(lead => lead.phone && lead.phone !== 'Need skip trace').length;
      console.log(`   📮 ${zip} (${cityName}): ${zipLeads.length} leads, ${callableCount} callable`);
    }
    
    console.log('\n📞 NEXT ACTIONS:');
    console.log('   1. Focus on zip codes with most callable leads');
    console.log('   2. Start with highest scoring leads in each zip');
    console.log('   3. Run skip trace on leads without phone numbers');
    console.log('   4. Search additional zip codes in your target area');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.disconnect();
  }
}

function getCityFromZip(zip: string): string {
  const zipMap: Record<string, string> = {
    // Phoenix zips
    '85001': 'Phoenix Downtown',
    '85003': 'Phoenix West',
    '85004': 'Phoenix Central',
    '85006': 'Phoenix Central',
    '85008': 'Phoenix South',
    '85015': 'Phoenix West',
    '85018': 'Phoenix East',
    '85032': 'Phoenix North',
    '85034': 'Phoenix Central',
    
    // Scottsdale zips
    '85251': 'Scottsdale Central',
    '85254': 'Scottsdale North',
    '85257': 'Scottsdale East',
    '85260': 'Scottsdale North',
    
    // Tempe zips
    '85281': 'Tempe Central',
    '85283': 'Tempe South',
    
    // Other
    '85301': 'Glendale',
    
    // Default
    'Unknown': 'Unknown Area'
  };
  
  return zipMap[zip] || `Unknown (${zip})`;
}

showZipCodeDashboard();
