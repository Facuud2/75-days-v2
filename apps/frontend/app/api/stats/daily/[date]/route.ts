import { handleRoute } from '@/lib/server/http';
import { getDailyStats } from '@/lib/server/controllers/health/statsController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getDailyStats, { auth: true });
  } catch (error) {
    console.error('[/api/stats/daily/[date]]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
