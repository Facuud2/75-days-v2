import { handleRoute } from '@/lib/server/http';
import { getAvailableQuests } from '@/lib/server/controllers/core/questController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getAvailableQuests, { auth: true });
  } catch (error) {
    console.error('[/api/quests/available]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
