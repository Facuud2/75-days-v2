import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { getFoodDetails, searchFoods } from '../lib/fatsecret';
import prisma from '../lib/prisma';
import { invalidateSystemIngredientsCache } from './customFoodController';

export const searchFoodController = async (req: AuthRequest, res: Response) => {
    try {
        const query = req.query.query as string;
        const page = parseInt((req.query.page as string) || '0', 10);

        if (!query) {
            return res.status(400).json({ error: 'Falta el parámetro q.' });
        }

        const data = await searchFoods(query, page);

        // Map the FatSecret response to a simpler format for our frontend
        let items: any[] = [];
        const foods = data?.foods?.food;

        if (Array.isArray(foods)) {
            items = foods;
        } else if (foods) {
            items = [foods];
        }

        const simplified = items.map((f: any) => ({
            id: f.food_id,
            name: f.food_name,
            description: f.food_description, // format usually: "Per 100g - Calories: 52kcal | Fat: 0.17g | Carbs: 13.81g | Protein: 0.26g"
            brand: f.brand_name || null
        }));

        res.json({
            results: simplified,
            page: data?.foods?.page_number,
            total_results: data?.foods?.total_results
        });

    } catch (error: any) {
        console.error('FatSecret Search Error:', error.message);
        res.status(500).json({ error: 'Error al buscar alimentos en FatSecret.' });
    }
};

export const getFoodController = async (req: AuthRequest, res: Response) => {
    try {
        const foodId = req.params.id as string;

        if (!foodId) {
            return res.status(400).json({ error: 'ID de alimento requerido.' });
        }

        const data = await getFoodDetails(foodId);
        const food = data?.food;

        if (!food) {
            return res.status(404).json({ error: 'Alimento no encontrado.' });
        }

        // FatSecret returns servings as an array or a single object. We'll simplify to return the array.
        let servings: any[] = [];
        if (food.servings && food.servings.serving) {
            if (Array.isArray(food.servings.serving)) {
                servings = food.servings.serving;
            } else {
                servings = [food.servings.serving];
            }
        }

        res.json({
            id: food.food_id,
            name: food.food_name,
            brand: food.brand_name || null,
            servings: servings.map((s: any) => ({
                id: s.serving_id,
                description: s.serving_description, // e.g. "1 medium"
                metricAmount: s.metric_serving_amount, // e.g. "118.000"
                metricUnit: s.metric_serving_unit, // e.g. "g"
                calories: parseFloat(s.calories || '0'),
                carbohydrates: parseFloat(s.carbohydrate || '0'),
                protein: parseFloat(s.protein || '0'),
                fat: parseFloat(s.fat || '0')
            }))
        });

    } catch (error: any) {
        console.error('FatSecret Get Food Error:', error.message);
        res.status(500).json({ error: 'Error al obtener detalle del alimento.' });
    }
};

export const importFoodController = async (req: AuthRequest, res: Response) => {
    try {
        const foodId = req.params.id as string;
        if (!foodId) return res.status(400).json({ error: 'ID de alimento requerido.' });

        const data = await getFoodDetails(foodId);
        const food = data?.food;

        if (!food) return res.status(404).json({ error: 'Alimento no encontrado.' });

        let servings: any[] = [];
        if (food.servings && food.servings.serving) {
            servings = Array.isArray(food.servings.serving) ? food.servings.serving : [food.servings.serving];
        }

        let selectedServing = servings.find(s => s.metric_serving_unit === 'g' && parseFloat(s.metric_serving_amount || '0') > 0);

        if (!selectedServing) {
            selectedServing = servings.find(s => s.metric_serving_unit === 'ml' && parseFloat(s.metric_serving_amount || '0') > 0);
        }

        if (!selectedServing) {
            selectedServing = servings[0];
        }

        if (!selectedServing) {
            return res.status(400).json({ error: 'No se encontraron porciones válidas para este alimento.' });
        }

        const metricAmount = parseFloat(selectedServing.metric_serving_amount || '0');
        let multiplier = 1;

        if (metricAmount > 0 && ['g', 'ml'].includes(selectedServing.metric_serving_unit?.toLowerCase())) {
            multiplier = 100 / metricAmount;
        } else {
            multiplier = 100 / (metricAmount > 0 ? metricAmount : 100);
        }

        const caloriesPer100g = parseFloat(selectedServing.calories || '0') * multiplier;
        const proteinPer100g = parseFloat(selectedServing.protein || '0') * multiplier;
        const carbPer100g = parseFloat(selectedServing.carbohydrate || '0') * multiplier;
        const fatPer100g = parseFloat(selectedServing.fat || '0') * multiplier;

        const ingredientName = `${food.food_name}${food.brand_name ? ` (${food.brand_name})` : ''}`;

        const ingredient = await prisma.ingredient.upsert({
            where: { name: ingredientName },
            update: {
                caloriesPer100g,
                proteinPer100g,
                carbPer100g,
                fatPer100g
            },
            create: {
                name: ingredientName,
                caloriesPer100g,
                proteinPer100g,
                carbPer100g,
                fatPer100g
            }
        });

        invalidateSystemIngredientsCache();
        return res.json(ingredient);
    } catch (error: any) {
        console.error('FatSecret Import Error:', error.message);
        res.status(500).json({ error: 'Error al importar el alimento.' });
    }
};
