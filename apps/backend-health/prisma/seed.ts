import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Catálogo base de ingredientes con macros por 100 g.
 * Valores aproximados, basados en tablas de composición de alimentos (USDA).
 * El seed es idempotente: hace upsert por `name`.
 *
 * Este catálogo es la materia prima de los alimentos personalizados.
 * Sin él, `POST /api/nutrition/custom-foods` no se puede usar (exige
 * al menos un `ingredientId` existente).
 */
const baseIngredients = [
    // ── Proteínas animales ──────────────────────────────────────────────────
    { name: 'Pechuga de pollo cocida', caloriesPer100g: 165, proteinPer100g: 31.0, carbPer100g: 0.0, fatPer100g: 3.6 },
    { name: 'Muslo de pollo cocido', caloriesPer100g: 209, proteinPer100g: 26.0, carbPer100g: 0.0, fatPer100g: 10.9 },
    { name: 'Carne vacuna magra cocida', caloriesPer100g: 250, proteinPer100g: 26.0, carbPer100g: 0.0, fatPer100g: 15.0 },
    { name: 'Carne picada 90/10 cocida', caloriesPer100g: 217, proteinPer100g: 26.0, carbPer100g: 0.0, fatPer100g: 12.0 },
    { name: 'Huevo entero', caloriesPer100g: 155, proteinPer100g: 13.0, carbPer100g: 1.1, fatPer100g: 11.0 },
    { name: 'Claras de huevo', caloriesPer100g: 52, proteinPer100g: 10.9, carbPer100g: 0.7, fatPer100g: 0.2 },
    { name: 'Atún al agua escurrido', caloriesPer100g: 116, proteinPer100g: 25.5, carbPer100g: 0.0, fatPer100g: 0.8 },
    { name: 'Salmón cocido', caloriesPer100g: 208, proteinPer100g: 20.0, carbPer100g: 0.0, fatPer100g: 13.0 },
    { name: 'Merluza cocida', caloriesPer100g: 105, proteinPer100g: 23.0, carbPer100g: 0.0, fatPer100g: 1.2 },
    { name: 'Lomo de cerdo cocido', caloriesPer100g: 143, proteinPer100g: 26.0, carbPer100g: 0.0, fatPer100g: 3.5 },
    { name: 'Jamón cocido', caloriesPer100g: 145, proteinPer100g: 18.0, carbPer100g: 1.5, fatPer100g: 7.0 },
    { name: 'Queso fresco magro', caloriesPer100g: 98, proteinPer100g: 11.0, carbPer100g: 3.0, fatPer100g: 4.5 },
    { name: 'Yogur griego natural descremado', caloriesPer100g: 59, proteinPer100g: 10.0, carbPer100g: 3.6, fatPer100g: 0.4 },
    { name: 'Leche entera', caloriesPer100g: 61, proteinPer100g: 3.2, carbPer100g: 4.8, fatPer100g: 3.3 },
    { name: 'Leche descremada', caloriesPer100g: 34, proteinPer100g: 3.4, carbPer100g: 5.0, fatPer100g: 0.1 },
    { name: 'Proteína de suero en polvo', caloriesPer100g: 400, proteinPer100g: 80.0, carbPer100g: 8.0, fatPer100g: 5.0 },
    { name: 'Tofu firme', caloriesPer100g: 76, proteinPer100g: 8.0, carbPer100g: 1.9, fatPer100g: 4.8 },

    // ── Legumbres ───────────────────────────────────────────────────────────
    { name: 'Lentejas cocidas', caloriesPer100g: 116, proteinPer100g: 9.0, carbPer100g: 20.0, fatPer100g: 0.4 },
    { name: 'Garbanzos cocidos', caloriesPer100g: 164, proteinPer100g: 8.9, carbPer100g: 27.0, fatPer100g: 2.6 },
    { name: 'Porotos negros cocidos', caloriesPer100g: 132, proteinPer100g: 8.9, carbPer100g: 24.0, fatPer100g: 0.5 },

    // ── Cereales y carbohidratos ────────────────────────────────────────────
    { name: 'Arroz blanco cocido', caloriesPer100g: 130, proteinPer100g: 2.7, carbPer100g: 28.0, fatPer100g: 0.3 },
    { name: 'Arroz integral cocido', caloriesPer100g: 123, proteinPer100g: 2.6, carbPer100g: 26.0, fatPer100g: 1.0 },
    { name: 'Pasta cocida', caloriesPer100g: 158, proteinPer100g: 5.8, carbPer100g: 31.0, fatPer100g: 0.9 },
    { name: 'Pan integral', caloriesPer100g: 247, proteinPer100g: 13.0, carbPer100g: 41.0, fatPer100g: 3.4 },
    { name: 'Pan blanco', caloriesPer100g: 265, proteinPer100g: 9.0, carbPer100g: 49.0, fatPer100g: 3.2 },
    { name: 'Avena en hojuelas', caloriesPer100g: 389, proteinPer100g: 16.9, carbPer100g: 66.0, fatPer100g: 6.9 },
    { name: 'Papa cocida', caloriesPer100g: 87, proteinPer100g: 1.9, carbPer100g: 20.0, fatPer100g: 0.1 },
    { name: 'Batata cocida', caloriesPer100g: 90, proteinPer100g: 2.0, carbPer100g: 21.0, fatPer100g: 0.2 },
    { name: 'Quinoa cocida', caloriesPer100g: 120, proteinPer100g: 4.4, carbPer100g: 21.0, fatPer100g: 1.9 },
    { name: 'Tortilla de trigo', caloriesPer100g: 306, proteinPer100g: 8.0, carbPer100g: 51.0, fatPer100g: 7.0 },

    // ── Frutas ──────────────────────────────────────────────────────────────
    { name: 'Banana', caloriesPer100g: 89, proteinPer100g: 1.1, carbPer100g: 23.0, fatPer100g: 0.3 },
    { name: 'Manzana', caloriesPer100g: 52, proteinPer100g: 0.3, carbPer100g: 14.0, fatPer100g: 0.2 },
    { name: 'Naranja', caloriesPer100g: 47, proteinPer100g: 0.9, carbPer100g: 12.0, fatPer100g: 0.1 },
    { name: 'Frutillas', caloriesPer100g: 32, proteinPer100g: 0.7, carbPer100g: 7.7, fatPer100g: 0.3 },
    { name: 'Palta', caloriesPer100g: 160, proteinPer100g: 2.0, carbPer100g: 8.5, fatPer100g: 14.7 },

    // ── Verduras ────────────────────────────────────────────────────────────
    { name: 'Tomate', caloriesPer100g: 18, proteinPer100g: 0.9, carbPer100g: 3.9, fatPer100g: 0.2 },
    { name: 'Lechuga', caloriesPer100g: 15, proteinPer100g: 1.4, carbPer100g: 2.9, fatPer100g: 0.2 },
    { name: 'Brócoli cocido', caloriesPer100g: 35, proteinPer100g: 2.4, carbPer100g: 7.2, fatPer100g: 0.4 },
    { name: 'Zanahoria', caloriesPer100g: 41, proteinPer100g: 0.9, carbPer100g: 9.6, fatPer100g: 0.2 },
    { name: 'Cebolla', caloriesPer100g: 40, proteinPer100g: 1.1, carbPer100g: 9.3, fatPer100g: 0.1 },
    { name: 'Morrón rojo', caloriesPer100g: 31, proteinPer100g: 1.0, carbPer100g: 6.0, fatPer100g: 0.3 },
    { name: 'Espinaca', caloriesPer100g: 23, proteinPer100g: 2.9, carbPer100g: 3.6, fatPer100g: 0.4 },
    { name: 'Pepino', caloriesPer100g: 15, proteinPer100g: 0.7, carbPer100g: 3.6, fatPer100g: 0.1 },

    // ── Grasas, frutos secos y varios ───────────────────────────────────────
    { name: 'Aceite de oliva', caloriesPer100g: 884, proteinPer100g: 0.0, carbPer100g: 0.0, fatPer100g: 100.0 },
    { name: 'Almendras', caloriesPer100g: 579, proteinPer100g: 21.0, carbPer100g: 22.0, fatPer100g: 50.0 },
    { name: 'Nueces', caloriesPer100g: 654, proteinPer100g: 15.0, carbPer100g: 14.0, fatPer100g: 65.0 },
    { name: 'Mantequilla de maní', caloriesPer100g: 588, proteinPer100g: 25.0, carbPer100g: 20.0, fatPer100g: 50.0 },
    { name: 'Miel', caloriesPer100g: 304, proteinPer100g: 0.3, carbPer100g: 82.0, fatPer100g: 0.0 },
    { name: 'Azúcar', caloriesPer100g: 387, proteinPer100g: 0.0, carbPer100g: 100.0, fatPer100g: 0.0 },
    { name: 'Chocolate negro 70%', caloriesPer100g: 598, proteinPer100g: 7.8, carbPer100g: 46.0, fatPer100g: 43.0 },
    { name: 'Pan rallado', caloriesPer100g: 395, proteinPer100g: 13.0, carbPer100g: 72.0, fatPer100g: 5.0 },
];

async function main() {
    console.log(`Seeding ${baseIngredients.length} base ingredients...`);

    if (baseIngredients.length === 0) {
        throw new Error('baseIngredients está vacío: el catálogo quedaría inutilizable.');
    }

    let created = 0;
    let updated = 0;

    for (const item of baseIngredients) {
        const existing = await prisma.ingredient.findUnique({
            where: { name: item.name },
        });

        if (!existing) {
            await prisma.ingredient.create({ data: item });
            created++;
            console.log(`Created: ${item.name}`);
        } else {
            await prisma.ingredient.update({
                where: { id: existing.id },
                data: item,
            });
            updated++;
        }
    }

    console.log(`Seeding finished. Created: ${created}, updated: ${updated}.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
