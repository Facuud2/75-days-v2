import { PrismaClient } from '@prisma/client';

declare global {
    var corePrisma: PrismaClient | undefined;
}

export const prisma = global.corePrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') global.corePrisma = prisma;
