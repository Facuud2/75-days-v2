const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { differenceInCalendarDays } = require('date-fns');

async function main() {
  const challenges = await prisma.challenge.findMany();
  for (const c of challenges) {
    const start = new Date(c.startDate);
    const now = new Date();
    const diff = differenceInCalendarDays(now, start) + 1;
    console.log(`Challenge: ${c.id}, Start: ${c.startDate.toISOString()}, Local Start: ${start.toString()}, Local Now: ${now.toString()}, Diff: ${diff}, DB currentDay: ${c.currentDay}`);
  }
}
main().finally(() => prisma.$disconnect());
