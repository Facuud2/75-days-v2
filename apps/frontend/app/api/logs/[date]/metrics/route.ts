import { handleRoute } from '@/lib/server/http';
import { updateMetrics } from '@/lib/server/controllers/core/logController';

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, updateMetrics, { auth: true });
  } catch (error) {
    console.error('[/api/logs/[date]/metrics]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
