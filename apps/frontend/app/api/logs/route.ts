import { handleRoute } from '@/lib/server/http';
import { getLogs } from '@/lib/server/controllers/core/logController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getLogs, { auth: true });
  } catch (error) {
    console.error('[/api/logs]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
