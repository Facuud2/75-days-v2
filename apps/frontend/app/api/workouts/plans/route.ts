import { handleRoute } from '@/lib/server/http';
import {
  createTrainingPlan,
  listTrainingPlans,
} from '@/lib/server/controllers/health/trainingPlanController';

export async function GET(req: Request, context: any) {
  return handleRoute(req, context, listTrainingPlans, { auth: true });
}

export async function POST(req: Request, context: any) {
  return handleRoute(req, context, createTrainingPlan, { auth: true });
}
