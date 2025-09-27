import { PrismaClient } from '@prisma/client';
// Ensure a single PrismaClient instance across hot-reloads/tests
const g = global;
export const prisma = g.__LEADFLOW_PRISMA__ || new PrismaClient();
if (process.env.NODE_ENV === 'test') {
    g.__LEADFLOW_PRISMA__ = prisma;
}
export async function disconnectPrisma() {
    try {
        await prisma.$disconnect();
    }
    catch { }
}
//# sourceMappingURL=prisma.js.map