import { handleRoute } from '@/lib/server/http';
import { checkDailyReset } from '@/lib/server/controllers/core/logController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, checkDailyReset, { auth: true });
  } catch (error) {
    console.error('[/api/logs/check-reset]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
