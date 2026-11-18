import { handleRoute } from '@/lib/server/http';
import { getWeeklyStats } from '@/lib/server/controllers/health/statsController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getWeeklyStats, { auth: true });
  } catch (error) {
    console.error('[/api/stats/weekly]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
