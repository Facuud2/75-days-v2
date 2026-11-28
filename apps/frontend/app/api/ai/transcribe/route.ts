import { handleRoute } from '@/lib/server/http';
import { transcribeAudio } from '@/lib/server/controllers/core/aiController';

export const maxDuration = 60;

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, transcribeAudio, {
      auth: true,
      rateLimit: 'ai',
    });
  } catch (error) {
    console.error('[/api/ai/transcribe]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
