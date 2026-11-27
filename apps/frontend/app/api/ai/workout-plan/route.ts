import { handleRoute } from '@/lib/server/http';
import { planWorkoutWithAi } from '@/lib/server/controllers/core/aiController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, planWorkoutWithAi, {
      auth: true,
      rateLimit: 'ai',
    });
  } catch (error) {
    console.error('[/api/ai/workout-plan]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
