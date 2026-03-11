import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const baseIngredients: any[] = [];

async function main() {
    console.log('Start seeding Base Ingredients...');

    for (const item of baseIngredients) {
        const existing = await prisma.ingredient.findUnique({
            where: { name: item.name }
        });

        if (!existing) {
            await prisma.ingredient.create({
                data: item
            });
            console.log(`Created: ${item.name}`);
        } else {
            console.log(`Skipped (already exists): ${item.name}`);
        }
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
