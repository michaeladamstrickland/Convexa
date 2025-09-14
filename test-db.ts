import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabase() {
  console.log('🧪 Testing database connection...');
  
  try {
    // Test leads
    const leads = await prisma.lead.findMany();
    console.log(`✅ Found ${leads.length} leads in database`);
    
    // Test probate cases
    const probateCases = await prisma.probateCase.findMany();
    console.log(`✅ Found ${probateCases.length} probate cases`);
    
    // Test violations
    const violations = await prisma.propertyViolation.findMany();
    console.log(`✅ Found ${violations.length} property violations`);
    
    // Show sample lead
    if (leads.length > 0) {
      console.log('\n📋 Sample Lead:');
      console.log(`Address: ${leads[0].address}`);
      console.log(`Owner: ${leads[0].owner_name}`);
      console.log(`Value: $${leads[0].estimated_value?.toLocaleString()}`);
      console.log(`Score: ${leads[0].lead_score}/100`);
      console.log(`Source: ${leads[0].source_type}`);
    }
    
    console.log('\n🎯 DATABASE IS WORKING! Ready for real lead generation!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
