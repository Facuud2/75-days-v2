import { handleRoute } from '@/lib/server/http';
import { analyzeMeal } from '@/lib/server/controllers/core/aiController';

export const maxDuration = 60;

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, analyzeMeal, {
      auth: true,
      rateLimit: 'ai',
    });
  } catch (error) {
    console.error('[/api/ai/analyze-meal]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
