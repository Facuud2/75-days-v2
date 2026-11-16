import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    healthPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.healthPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.healthPrisma = prisma;
}

export default prisma;
