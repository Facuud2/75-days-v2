import { handleRoute } from '@/lib/server/http';
import { getStravaStatus } from '@/lib/server/controllers/health/stravaController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getStravaStatus, { auth: true });
  } catch (error) {
    console.error('[/api/strava/status]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
