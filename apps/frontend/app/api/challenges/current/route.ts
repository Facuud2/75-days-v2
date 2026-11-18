import { handleRoute } from '@/lib/server/http';
import { getCurrentChallenge } from '@/lib/server/controllers/core/challengeController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getCurrentChallenge, { auth: true });
  } catch (error) {
    console.error('[/api/challenges/current]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
