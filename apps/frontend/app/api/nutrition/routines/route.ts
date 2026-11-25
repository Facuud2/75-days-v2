import { handleRoute } from '@/lib/server/http';
import {
  createMealRoutine,
  listMealRoutines,
} from '@/lib/server/controllers/health/mealRoutineController';

export async function GET(req: Request, context: any) {
  return handleRoute(req, context, listMealRoutines, { auth: true });
}

export async function POST(req: Request, context: any) {
  return handleRoute(req, context, createMealRoutine, { auth: true });
}
