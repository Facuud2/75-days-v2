import { handleRoute } from '@/lib/server/http';
import { getExerciseLastSetsBatch } from '@/lib/server/controllers/health/workoutController';

export async function GET(req: Request, context: any) {
  return handleRoute(req, context, getExerciseLastSetsBatch, { auth: true });
}
