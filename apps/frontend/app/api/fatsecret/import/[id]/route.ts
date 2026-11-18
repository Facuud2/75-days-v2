import { handleRoute } from '@/lib/server/http';
import { importFoodController } from '@/lib/server/controllers/health/fatsecretController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, importFoodController, { auth: true });
  } catch (error) {
    console.error('[/api/fatsecret/import/[id]]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
