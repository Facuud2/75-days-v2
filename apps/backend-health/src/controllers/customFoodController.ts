import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';

const CustomFoodSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(500).optional().nullable(),
    servingSize: z.string().max(100).optional().nullable(),
    ingredients: z.array(z.object({
        ingredientId: z.string().uuid(),
        weightGrams: z.number().min(1)
    }).strict()).min(1, "Debe tener al menos un ingrediente")
}).strict();

const INGREDIENTS_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedIngredients: { data: any[]; expiresAt: number } | null = null;

export function invalidateSystemIngredientsCache() {
    cachedIngredients = null;
}

export async function fetchCachedSystemIngredients() {
    const now = Date.now();
    if (cachedIngredients && cachedIngredients.expiresAt > now) {
        return cachedIngredients.data;
    }
    const ingredients = await prisma.ingredient.findMany({
        orderBy: { name: 'asc' },
    });
    cachedIngredients = {
        data: ingredients,
        expiresAt: now + INGREDIENTS_CACHE_TTL_MS,
    };
    return ingredients;
}

export const getSystemIngredients = async (_req: AuthRequest, res: Response) => {
    const ingredients = await fetchCachedSystemIngredients();
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=3600');
    return res.json(ingredients);
};

export const createCustomFood = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const parsed = CustomFoodSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    let totalCals = 0;
    let totalP = 0;
    let totalC = 0;
    let totalF = 0;

    // Fetch ingredient macros to calculate totals
    const ingredientIds = parsed.data.ingredients.map(i => i.ingredientId);
    const dbIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } }
    });

    const ingredientMap = new Map(dbIngredients.map(i => [i.id, i]));

    for (const item of parsed.data.ingredients) {
        const ing = ingredientMap.get(item.ingredientId);
        if (!ing) return res.status(400).json({ error: `Ingrediente no encontrado: ${item.ingredientId}` });

        const multiplier = item.weightGrams / 100;
        totalCals += ing.caloriesPer100g * multiplier;
        totalP += ing.proteinPer100g * multiplier;
        totalC += ing.carbPer100g * multiplier;
        totalF += ing.fatPer100g * multiplier;
    }

    const food = await prisma.customFood.create({
        data: {
            userId,
            name: parsed.data.name,
            description: parsed.data.description,
            servingSize: parsed.data.servingSize,
            calories: Math.round(totalCals),
            proteinG: Math.round(totalP * 10) / 10,
            carbG: Math.round(totalC * 10) / 10,
            fatG: Math.round(totalF * 10) / 10,
            ingredients: {
                create: parsed.data.ingredients.map(i => ({
                    ingredientId: i.ingredientId,
                    weightGrams: i.weightGrams
                }))
            }
        },
        include: {
            ingredients: { include: { ingredient: true } }
        }
    });

    return res.status(201).json(food);
};

export const getCustomFoods = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const foods = await prisma.customFood.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            ingredients: { include: { ingredient: true } }
        }
    });

    return res.json(foods);
};

export const updateCustomFood = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const foodId = req.params.id;
    const parsed = CustomFoodSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    // Ensure it belongs to user
    const existing = await prisma.customFood.findUnique({ where: { id: foodId } });
    if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: 'Food not found' });
    }

    // Calc new totals
    let totalCals = 0, totalP = 0, totalC = 0, totalF = 0;
    const ingredientIds = parsed.data.ingredients.map(i => i.ingredientId);
    const dbIngredients = await prisma.ingredient.findMany({ where: { id: { in: ingredientIds } } });
    const ingredientMap = new Map(dbIngredients.map(i => [i.id, i]));

    for (const item of parsed.data.ingredients) {
        const ing = ingredientMap.get(item.ingredientId);
        if (!ing) return res.status(400).json({ error: `Ingrediente no encontrado: ${item.ingredientId}` });
        const multiplier = item.weightGrams / 100;
        totalCals += ing.caloriesPer100g * multiplier;
        totalP += ing.proteinPer100g * multiplier;
        totalC += ing.carbPer100g * multiplier;
        totalF += ing.fatPer100g * multiplier;
    }

    // Update using an explicit transaction to recreate ingredients relation
    const updated = await prisma.$transaction(async (tx) => {
        // Delete old relation
        await tx.customFoodIngredient.deleteMany({ where: { customFoodId: foodId } });

        // Update top-level macros and insert new ingredients
        return tx.customFood.update({
            where: { id: foodId },
            data: {
                name: parsed.data.name,
                description: parsed.data.description,
                servingSize: parsed.data.servingSize,
                calories: Math.round(totalCals),
                proteinG: Math.round(totalP * 10) / 10,
                carbG: Math.round(totalC * 10) / 10,
                fatG: Math.round(totalF * 10) / 10,
                ingredients: {
                    create: parsed.data.ingredients.map(i => ({
                        ingredientId: i.ingredientId,
                        weightGrams: i.weightGrams
                    }))
                }
            },
            include: {
                ingredients: { include: { ingredient: true } }
            }
        });
    });

    return res.json(updated);
};

export const deleteCustomFood = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const foodId = req.params.id;

    const existing = await prisma.customFood.findUnique({ where: { id: foodId } });
    if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: 'Food not found' });
    }

    await prisma.customFood.delete({ where: { id: foodId } });

    return res.status(204).send();
};
