import { handleRoute } from '@/lib/server/http';
import { progressQuest } from '@/lib/server/controllers/core/questController';

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, progressQuest, { auth: true });
  } catch (error) {
    console.error('[/api/quests/[id]/progress]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
