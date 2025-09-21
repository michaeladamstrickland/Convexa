const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportLead(leadId) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      console.log(`Lead with ID ${leadId} not found.`);
      return;
    }

    const outputDir = path.join(process.cwd(), 'ops', 'DSR_exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `lead_export_${leadId}.json`;
    const filePath = path.join(outputDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(lead, null, 2));
    console.log(`Lead data for ID ${leadId} exported to ${filePath}`);

  } catch (error) {
    console.error(`Error exporting lead ${leadId}:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

const leadId = process.argv[2];

if (!leadId) {
  console.log('Usage: node scripts/exportLead.cjs <leadId>');
  process.exit(1);
}

exportLead(leadId);
