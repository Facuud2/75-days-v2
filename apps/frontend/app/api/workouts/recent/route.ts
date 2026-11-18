import { handleRoute } from '@/lib/server/http';
import { getRecentWorkouts } from '@/lib/server/controllers/health/workoutController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getRecentWorkouts, { auth: true });
  } catch (error) {
    console.error('[/api/workouts/recent]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
