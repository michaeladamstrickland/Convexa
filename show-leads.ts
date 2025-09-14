import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showYourMoneyMakingLeads() {
  console.log('💰 YOUR MONEY-MAKING LEADS - READY TO CALL TODAY!');
  console.log('=====================================================\n');
  
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { lead_score: 'desc' }
    });

    leads.forEach((lead, index) => {
      console.log(`🎯 LEAD #${index + 1}: ${lead.address}`);
      console.log(`👤 Owner: ${lead.owner_name}`);
      console.log(`📞 Phone: ${lead.phone || 'Need skip trace'}`);
      console.log(`💰 Value: $${lead.estimated_value?.toLocaleString()}`);
      console.log(`📊 Score: ${lead.lead_score}/100`);
      console.log(`🎯 Source: ${lead.source_type}`);
      console.log(`📝 Notes: ${lead.notes || 'Ready to contact'}`);
      console.log(`───────────────────────────────────────────────────\n`);
    });

    // Show revenue potential
    const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    const probateLeads = leads.filter(lead => lead.is_probate).length;
    const highScoreLeads = leads.filter(lead => lead.lead_score >= 80).length;

    console.log('💵 REVENUE POTENTIAL:');
    console.log('===================');
    console.log(`📊 Total Leads: ${leads.length}`);
    console.log(`💎 High-Score Leads: ${highScoreLeads} (80+ score)`);
    console.log(`⚖️ Probate Leads: ${probateLeads} (highest conversion)`);
    console.log(`💰 Total Property Value: $${totalValue.toLocaleString()}`);
    console.log(`💵 Immediate Lead Sales Value: $${leads.length * 125}`);
    console.log(`🏆 Deal Potential: $${highScoreLeads * 5000} (est. $5K profit each)`);
    console.log('\n🚀 START CALLING THESE LEADS TODAY!');
    console.log('🎯 Focus on probate leads first - highest ROI!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showYourMoneyMakingLeads();
