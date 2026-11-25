import { handleRoute } from '@/lib/server/http';
import { applyMealRoutineToDate } from '@/lib/server/controllers/health/mealRoutineController';

export async function POST(req: Request, context: any) {
  return handleRoute(req, context, applyMealRoutineToDate, { auth: true });
}
