import { handleRoute } from '@/lib/server/http';
import { logMeal } from '@/lib/server/controllers/health/nutritionController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, logMeal, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/meals]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
