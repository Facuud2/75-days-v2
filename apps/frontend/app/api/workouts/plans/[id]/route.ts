import { handleRoute } from '@/lib/server/http';
import {
  deleteTrainingPlan,
  updateTrainingPlan,
} from '@/lib/server/controllers/health/trainingPlanController';

export async function PATCH(req: Request, context: any) {
  return handleRoute(req, context, updateTrainingPlan, { auth: true });
}

export async function DELETE(req: Request, context: any) {
  return handleRoute(req, context, deleteTrainingPlan, { auth: true });
}
