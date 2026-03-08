import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const baseIngredients = [
    // Proteins
    { name: 'Pechuga de Pollo', caloriesPer100g: 165, proteinPer100g: 31, carbPer100g: 0, fatPer100g: 3.6 },
    { name: 'Huevo Entero', caloriesPer100g: 155, proteinPer100g: 13, carbPer100g: 1.1, fatPer100g: 11 },
    { name: 'Clara de Huevo', caloriesPer100g: 52, proteinPer100g: 11, carbPer100g: 0.7, fatPer100g: 0.2 },
    { name: 'Proteína Whey (Polvo)', caloriesPer100g: 377, proteinPer100g: 78, carbPer100g: 7, fatPer100g: 4 },
    { name: 'Carne Magra de Res', caloriesPer100g: 250, proteinPer100g: 26, carbPer100g: 0, fatPer100g: 15 },
    { name: 'Atún al Natural', caloriesPer100g: 116, proteinPer100g: 26, carbPer100g: 0, fatPer100g: 0.8 },
    { name: 'Salmón', caloriesPer100g: 208, proteinPer100g: 20, carbPer100g: 0, fatPer100g: 13 },

    // Carbs
    { name: 'Arroz Blanco (Cocido)', caloriesPer100g: 130, proteinPer100g: 2.7, carbPer100g: 28, fatPer100g: 0.3 },
    { name: 'Arroz Integral (Cocido)', caloriesPer100g: 112, proteinPer100g: 2.3, carbPer100g: 24, fatPer100g: 0.9 },
    { name: 'Avena en Hojuelas', caloriesPer100g: 389, proteinPer100g: 16.9, carbPer100g: 66.3, fatPer100g: 6.9 },
    { name: 'Papa/Patata (Hervida)', caloriesPer100g: 87, proteinPer100g: 1.9, carbPer100g: 20, fatPer100g: 0.1 },
    { name: 'Batata/Boniato', caloriesPer100g: 86, proteinPer100g: 1.6, carbPer100g: 20, fatPer100g: 0.1 },
    { name: 'Pan Integral', caloriesPer100g: 247, proteinPer100g: 13, carbPer100g: 41, fatPer100g: 3.4 },

    // Fats
    { name: 'Palta / Aguacate', caloriesPer100g: 160, proteinPer100g: 2, carbPer100g: 9, fatPer100g: 15 },
    { name: 'Aceite de Oliva', caloriesPer100g: 884, proteinPer100g: 0, carbPer100g: 0, fatPer100g: 100 },
    { name: 'Mantequilla de Maní', caloriesPer100g: 588, proteinPer100g: 25, carbPer100g: 20, fatPer100g: 50 },
    { name: 'Almendras', caloriesPer100g: 579, proteinPer100g: 21, carbPer100g: 22, fatPer100g: 50 },

    // Fruits & Veg
    { name: 'Banana', caloriesPer100g: 89, proteinPer100g: 1.1, carbPer100g: 23, fatPer100g: 0.3 },
    { name: 'Manzana', caloriesPer100g: 52, proteinPer100g: 0.3, carbPer100g: 14, fatPer100g: 0.2 },
    { name: 'Brócoli', caloriesPer100g: 34, proteinPer100g: 2.8, carbPer100g: 7, fatPer100g: 0.4 },
    { name: 'Espinaca', caloriesPer100g: 23, proteinPer100g: 2.9, carbPer100g: 3.6, fatPer100g: 0.4 },

    // Dairy
    { name: 'Leche Entera', caloriesPer100g: 61, proteinPer100g: 3.2, carbPer100g: 4.8, fatPer100g: 3.3 },
    { name: 'Leche Descremada', caloriesPer100g: 34, proteinPer100g: 3.4, carbPer100g: 5, fatPer100g: 0.1 },
    { name: 'Queso Mozzarella', caloriesPer100g: 280, proteinPer100g: 28, carbPer100g: 3.1, fatPer100g: 17 }
];

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
