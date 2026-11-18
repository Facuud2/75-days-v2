import { handleRoute } from '@/lib/server/http';
import { getFoodController } from '@/lib/server/controllers/health/fatsecretController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getFoodController, { auth: true });
  } catch (error) {
    console.error('[/api/fatsecret/food/[id]]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
