import { handleRoute } from '@/lib/server/http';
import { abandonChallenge } from '@/lib/server/controllers/core/challengeController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, abandonChallenge, { auth: true });
  } catch (error) {
    console.error('[/api/challenges/abandon]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
