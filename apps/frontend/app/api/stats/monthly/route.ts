import { handleRoute } from '@/lib/server/http';
import { getMonthlyStats } from '@/lib/server/controllers/health/statsController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getMonthlyStats, { auth: true });
  } catch (error) {
    console.error('[/api/stats/monthly]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
