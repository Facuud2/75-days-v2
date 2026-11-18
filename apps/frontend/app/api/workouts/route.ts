import { handleRoute } from '@/lib/server/http';
import { logWorkout } from '@/lib/server/controllers/health/workoutController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, logWorkout, { auth: true });
  } catch (error) {
    console.error('[/api/workouts POST]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
