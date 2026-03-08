import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { searchFoods, getFoodDetails } from '../lib/fatsecret';

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
