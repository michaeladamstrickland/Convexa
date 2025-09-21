const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteLead(leadId) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      console.log(`Lead with ID ${leadId} not found.`);
      return;
    }

    await prisma.lead.delete({
      where: { id: leadId },
    });

    console.log(`Lead with ID ${leadId} and associated data deleted successfully.`);

  } catch (error) {
    console.error(`Error deleting lead ${leadId}:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

const leadId = process.argv[2];

if (!leadId) {
  console.log('Usage: node scripts/deleteLead.cjs <leadId>');
  process.exit(1);
}

deleteLead(leadId);
