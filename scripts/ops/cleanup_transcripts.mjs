import { prisma } from '../../backend/src/db/prisma.js';

async function cleanupTranscripts() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedTranscripts = await prisma.callTranscript.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    console.log(`Cleaned up ${deletedTranscripts.count} old call transcripts.`);
  } catch (error) {
    console.error('Error cleaning up old transcripts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTranscripts();
