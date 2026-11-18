import { handleRoute } from '@/lib/server/http';
import { startChallenge } from '@/lib/server/controllers/core/challengeController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, startChallenge, { auth: true });
  } catch (error) {
    console.error('[/api/challenges/start]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
