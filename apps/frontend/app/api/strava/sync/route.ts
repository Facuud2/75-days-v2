import { handleRoute } from '@/lib/server/http';
import { syncStravaWorkouts } from '@/lib/server/controllers/health/stravaController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, syncStravaWorkouts, { auth: true });
  } catch (error) {
    console.error('[/api/strava/sync]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
