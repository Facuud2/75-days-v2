import { handleRoute } from '@/lib/server/http';
import { getInternalSummary } from '@/lib/server/utils/healthSummary';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getInternalSummary, {
      internalAuth: true,
    });
  } catch (error) {
    console.error('[/api/internal/summary/[userId]/[date]]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
