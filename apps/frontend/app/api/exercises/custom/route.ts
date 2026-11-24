import { handleRoute } from '@/lib/server/http';
import {
  createCustomExercise,
  listCustomExercises,
} from '@/lib/server/controllers/health/customExerciseController';

export async function GET(req: Request, context: any) {
  return handleRoute(req, context, listCustomExercises, { auth: true });
}

export async function POST(req: Request, context: any) {
  return handleRoute(req, context, createCustomExercise, { auth: true });
}
