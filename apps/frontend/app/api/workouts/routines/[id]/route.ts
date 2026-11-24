import { handleRoute } from '@/lib/server/http';
import {
  deleteRoutine,
  updateRoutine,
} from '@/lib/server/controllers/health/routineController';

export async function PUT(req: Request, context: any) {
  return handleRoute(req, context, updateRoutine, { auth: true });
}

export async function DELETE(req: Request, context: any) {
  return handleRoute(req, context, deleteRoutine, { auth: true });
}
