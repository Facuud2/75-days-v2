import { handleRoute } from '@/lib/server/http';
import {
  deleteWorkout,
  getWorkoutsForDay,
  updateWorkout,
} from '@/lib/server/controllers/health/workoutController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getWorkoutsForDay, { auth: true });
  } catch (error) {
    console.error('[/api/workouts/[param] GET]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, updateWorkout, { auth: true });
  } catch (error) {
    console.error('[/api/workouts/[param] PUT]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: any) {
  try {
    return await handleRoute(req, context, deleteWorkout, { auth: true });
  } catch (error) {
    console.error('[/api/workouts/[param] DELETE]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
