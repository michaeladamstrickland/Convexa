#!/usr/bin/env node

// REVENUE DASHBOARD - Track your money-making progress

import { DatabaseService } from './src/services/databaseService';

async function showRevenueDashboard() {
  const db = new DatabaseService();
  
  try {
    const leads = await db.getLeads();
    
    console.log('💰 LEADFLOW AI REVENUE DASHBOARD');
    console.log('=' .repeat(50));
    
    // Lead counts by source
    const sourceStats: Record<string, number> = {};
    leads.forEach(lead => {
      sourceStats[lead.source_type] = (sourceStats[lead.source_type] || 0) + 1;
    });
    
    console.log('\n📊 LEAD SOURCES:');
    Object.entries(sourceStats).forEach(([source, count]) => {
      console.log(`   ${source.replace('_', ' ').toUpperCase()}: ${count} leads`);
    });
    
    // Revenue calculations
    const totalLeads = leads.length;
    const highScoreLeads = leads.filter(l => l.lead_score >= 70).length;
    const probateLeads = leads.filter(l => l.is_probate).length;
    const withPhone = leads.filter(l => l.phone && l.phone !== 'Need skip trace').length;
    
    console.log('\n📈 LEAD QUALITY:');
    console.log(`   📊 Total Leads: ${totalLeads}`);
    console.log(`   🎯 High Score (70+): ${highScoreLeads}`);
    console.log(`   ⚖️ Probate Leads: ${probateLeads}`);
    console.log(`   📞 Ready to Call: ${withPhone}`);
    
    // Revenue potential
    const leadSalesValue = totalLeads * 125;
    const avgDealProfit = 25000;
    const conversionRate = 0.15; // 15%
    const estimatedDeals = Math.round(totalLeads * conversionRate);
    const dealRevenue = estimatedDeals * avgDealProfit;
    const totalRevenue = leadSalesValue + dealRevenue;
    
    console.log('\n💵 REVENUE POTENTIAL:');
    console.log(`   💰 Lead Sales: $${leadSalesValue.toLocaleString()} (${totalLeads} x $125)`);
    console.log(`   🏠 Deal Revenue: $${dealRevenue.toLocaleString()} (${estimatedDeals} deals x $${avgDealProfit.toLocaleString()})`);
    console.log(`   🚀 TOTAL POTENTIAL: $${totalRevenue.toLocaleString()}`);
    
    // Today's action items
    console.log('\n🎯 TODAY\'S ACTION PLAN:');
    console.log('   1. 📞 Call Sarah Johnson-Martinez (480) 555-0156 - Probate lead');
    console.log('   2. 📞 Call Carlos Rodriguez (602) 555-0198 - Code violations');
    console.log('   3. 📞 Call Robert Williams (623) 555-0156 - FSBO retirement');
    console.log('   4. 📧 Send follow-up emails to leads without phone numbers');
    console.log('   5. 🔍 Run skip trace on high-value leads');
    
    console.log('\n💡 PRO TIPS:');
    console.log('   • Focus on probate leads first (highest conversion)');
    console.log('   • Call between 10AM-7PM weekdays');
    console.log('   • Offer 75-85% of property value for quick cash deals');
    console.log('   • Follow up within 24-48 hours of initial contact');
    
    console.log('\n✅ YOUR LEADFLOW AI SYSTEM IS MAKING MONEY!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.disconnect();
  }
}

showRevenueDashboard();
