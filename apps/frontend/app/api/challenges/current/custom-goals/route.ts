import { handleRoute } from '@/lib/server/http';
import { updateCustomGoals } from '@/lib/server/controllers/core/challengeController';

export async function PATCH(req: Request, context: any) {
  try {
    return await handleRoute(req, context, updateCustomGoals, { auth: true });
  } catch (error) {
    console.error('[/api/challenges/current/custom-goals]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
