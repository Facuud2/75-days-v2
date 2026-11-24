import { handleRoute } from '@/lib/server/http';
import {
  createRoutine,
  listRoutines,
} from '@/lib/server/controllers/health/routineController';

export async function GET(req: Request, context: any) {
  return handleRoute(req, context, listRoutines, { auth: true });
}

export async function POST(req: Request, context: any) {
  return handleRoute(req, context, createRoutine, { auth: true });
}
