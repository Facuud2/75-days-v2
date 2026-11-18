import { handleRoute } from '@/lib/server/http';
import { toggleQuestTask } from '@/lib/server/controllers/core/questController';

export async function PATCH(req: Request, context: any) {
  try {
    return await handleRoute(req, context, toggleQuestTask, { auth: true });
  } catch (error) {
    console.error('[/api/quests/[id]/tasks/[taskId]]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
