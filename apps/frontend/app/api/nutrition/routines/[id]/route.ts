import { handleRoute } from '@/lib/server/http';
import {
  deleteMealRoutine,
  updateMealRoutine,
} from '@/lib/server/controllers/health/mealRoutineController';

export async function PUT(req: Request, context: any) {
  return handleRoute(req, context, updateMealRoutine, { auth: true });
}

export async function PATCH(req: Request, context: any) {
  return handleRoute(req, context, updateMealRoutine, { auth: true });
}

export async function DELETE(req: Request, context: any) {
  return handleRoute(req, context, deleteMealRoutine, { auth: true });
}
