import { handleRoute } from '@/lib/server/http';
import { getCoreSync } from '@/lib/server/controllers/core/syncController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getCoreSync, { auth: true });
  } catch (error) {
    console.error('[/api/sync]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
