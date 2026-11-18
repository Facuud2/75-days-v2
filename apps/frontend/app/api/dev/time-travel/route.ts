import { handleRoute } from '@/lib/server/http';
import { timeTravel } from '@/lib/server/controllers/core/devController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, timeTravel, {
      auth: true,
      devOnly: true,
    });
  } catch (error) {
    console.error('[/api/dev/time-travel]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
