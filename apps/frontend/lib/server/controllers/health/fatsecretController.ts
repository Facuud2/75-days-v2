import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { getFoodDetails, searchFoods } from '../../utils/fatsecret';
import { invalidateSystemIngredientsCache } from './customFoodController';

export const searchFoodController = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const rawQuery = req.query.query;
    const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
    const parsedPage = parseInt((req.query.page as string) || '0', 10);
    const page = Number.isFinite(parsedPage) && parsedPage >= 0 && parsedPage <= 100 ? parsedPage : 0;

    if (!query || query.length > 100) {
      return res.status(400).json({ error: 'Parámetro de búsqueda inválido (1–100 caracteres).' });
    }

    const data = await searchFoods(query, page);

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
      description: f.food_description,
      brand: f.brand_name || null,
    }));

    return res.json({
      results: simplified,
      page: data?.foods?.page_number,
      total_results: data?.foods?.total_results,
    });
  } catch (error: any) {
    console.error('[fatsecretController.searchFoodController]', error?.message);
    return res.status(500).json({ error: 'Error al buscar alimentos en FatSecret.' });
  }
};

export const getFoodController = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const foodId = req.params.id as string;

    if (!foodId || !/^\d{1,20}$/.test(foodId)) {
      return res.status(400).json({ error: 'ID de alimento inválido.' });
    }

    const data = await getFoodDetails(foodId);
    const food = data?.food;

    if (!food) {
      return res.status(404).json({ error: 'Alimento no encontrado.' });
    }

    let servings: any[] = [];
    if (food.servings && food.servings.serving) {
      if (Array.isArray(food.servings.serving)) {
        servings = food.servings.serving;
      } else {
        servings = [food.servings.serving];
      }
    }

    return res.json({
      id: food.food_id,
      name: food.food_name,
      brand: food.brand_name || null,
      servings: servings.map((s: any) => ({
        id: s.serving_id,
        description: s.serving_description,
        metricAmount: s.metric_serving_amount,
        metricUnit: s.metric_serving_unit,
        calories: parseFloat(s.calories || '0'),
        carbohydrates: parseFloat(s.carbohydrate || '0'),
        protein: parseFloat(s.protein || '0'),
        fat: parseFloat(s.fat || '0'),
      })),
    });
  } catch (error: any) {
    console.error('[fatsecretController.getFoodController]', error?.message);
    return res.status(500).json({ error: 'Error al obtener detalle del alimento.' });
  }
};

export const importFoodController = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const foodId = req.params.id as string;
    if (!foodId || !/^\d{1,20}$/.test(foodId)) {
      return res.status(400).json({ error: 'ID de alimento inválido.' });
    }

    const data = await getFoodDetails(foodId);
    const food = data?.food;

    if (!food) return res.status(404).json({ error: 'Alimento no encontrado.' });
    const prisma = getHealthPrisma();

    let servings: any[] = [];
    if (food.servings && food.servings.serving) {
      servings = Array.isArray(food.servings.serving)
        ? food.servings.serving
        : [food.servings.serving];
    }

    let selectedServing = servings.find(
      (s) => s.metric_serving_unit === 'g' && parseFloat(s.metric_serving_amount || '0') > 0
    );

    if (!selectedServing) {
      selectedServing = servings.find(
        (s) => s.metric_serving_unit === 'ml' && parseFloat(s.metric_serving_amount || '0') > 0
      );
    }

    if (!selectedServing) {
      selectedServing = servings[0];
    }

    if (!selectedServing) {
      return res
        .status(400)
        .json({ error: 'No se encontraron porciones válidas para este alimento.' });
    }

    const metricAmount = parseFloat(selectedServing.metric_serving_amount || '0');
    let multiplier = 1;

    if (
      metricAmount > 0 &&
      ['g', 'ml'].includes(selectedServing.metric_serving_unit?.toLowerCase())
    ) {
      multiplier = 100 / metricAmount;
    } else {
      multiplier = 100 / (metricAmount > 0 ? metricAmount : 100);
    }

    const caloriesPer100g = parseFloat(selectedServing.calories || '0') * multiplier;
    const proteinPer100g = parseFloat(selectedServing.protein || '0') * multiplier;
    const carbPer100g = parseFloat(selectedServing.carbohydrate || '0') * multiplier;
    const fatPer100g = parseFloat(selectedServing.fat || '0') * multiplier;

    const ingredientName = `${food.food_name}${food.brand_name ? ` (${food.brand_name})` : ''}`.slice(0, 160);

    // Prevent authenticated users from overwriting seeded/existing global catalog ingredients
    const existing = await prisma.ingredient.findUnique({
      where: { name: ingredientName },
    });
    if (existing) {
      return res.json(existing);
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name: ingredientName,
        caloriesPer100g,
        proteinPer100g,
        carbPer100g,
        fatPer100g,
      },
    });

    invalidateSystemIngredientsCache();
    return res.json(ingredient);
  } catch (error: any) {
    console.error('[fatsecretController.importFoodController]', error?.message);
    return res.status(500).json({ error: 'Error al importar el alimento.' });
  }
};
