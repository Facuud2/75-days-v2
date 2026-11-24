import { handleRoute } from '@/lib/server/http';
import { deleteCustomExercise } from '@/lib/server/controllers/health/customExerciseController';

export async function DELETE(req: Request, context: any) {
  return handleRoute(req, context, deleteCustomExercise, { auth: true });
}
