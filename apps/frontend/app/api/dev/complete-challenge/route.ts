import { handleRoute } from '@/lib/server/http';
import { completeChallenge } from '@/lib/server/controllers/core/devController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, completeChallenge, {
      auth: true,
      devOnly: true,
    });
  } catch (error) {
    console.error('[/api/dev/complete-challenge]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
