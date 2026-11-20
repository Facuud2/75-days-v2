import { handleRoute } from '@/lib/server/http';
import { connectStrava } from '@/lib/server/controllers/health/stravaController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, connectStrava, {
      auth: true,
      rateLimit: 'external',
    });
  } catch (error) {
    console.error('[/api/strava/auth]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
