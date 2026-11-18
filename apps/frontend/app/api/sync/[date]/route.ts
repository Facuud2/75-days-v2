import { handleRoute } from '@/lib/server/http';
import { getHealthSync } from '@/lib/server/controllers/health/syncController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getHealthSync, { auth: true });
  } catch (error) {
    console.error('[/api/sync/[date]]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
