"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.disconnectPrisma = disconnectPrisma;
const client_1 = require("@prisma/client");
// Ensure a single PrismaClient instance across hot-reloads/tests
const g = global;
exports.prisma = g.__LEADFLOW_PRISMA__ || new client_1.PrismaClient();
if (process.env.NODE_ENV === 'test') {
    g.__LEADFLOW_PRISMA__ = exports.prisma;
}
async function disconnectPrisma() {
    try {
        await exports.prisma.$disconnect();
    }
    catch { }
}
//# sourceMappingURL=prisma.js.map