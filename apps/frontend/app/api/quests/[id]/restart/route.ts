import { handleRoute } from '@/lib/server/http';
import { restartQuest } from '@/lib/server/controllers/core/questController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, restartQuest, { auth: true });
  } catch (error) {
    console.error('[/api/quests/[id]/restart]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
