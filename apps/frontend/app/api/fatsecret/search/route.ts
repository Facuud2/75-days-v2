import { handleRoute } from '@/lib/server/http';
import { searchFoodController } from '@/lib/server/controllers/health/fatsecretController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, searchFoodController, { auth: true });
  } catch (error) {
    console.error('[/api/fatsecret/search]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
