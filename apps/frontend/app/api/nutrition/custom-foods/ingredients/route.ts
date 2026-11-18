import { handleRoute } from '@/lib/server/http';
import { getSystemIngredients } from '@/lib/server/controllers/health/customFoodController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getSystemIngredients, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/custom-foods/ingredients]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
