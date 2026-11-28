import { handleRoute } from '@/lib/server/http';
import { stravaCallback } from '@/lib/server/controllers/health/stravaController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, stravaCallback, { rateLimit: 'external' });
  } catch (error) {
    console.error('[/api/strava/callback]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
