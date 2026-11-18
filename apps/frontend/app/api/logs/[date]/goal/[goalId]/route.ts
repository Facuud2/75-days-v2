import { handleRoute } from '@/lib/server/http';
import { updateGoalStatus } from '@/lib/server/controllers/core/logController';

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, updateGoalStatus, { auth: true });
  } catch (error) {
    console.error('[/api/logs/[date]/goal/[goalId]]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
