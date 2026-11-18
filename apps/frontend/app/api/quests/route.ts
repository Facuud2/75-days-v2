import { handleRoute } from '@/lib/server/http';
import { addQuest, getQuests } from '@/lib/server/controllers/core/questController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getQuests, { auth: true });
  } catch (error) {
    console.error('[/api/quests GET]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, addQuest, { auth: true });
  } catch (error) {
    console.error('[/api/quests POST]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
