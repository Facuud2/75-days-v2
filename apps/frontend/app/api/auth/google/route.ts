import { handleRoute } from '@/lib/server/http';
import { googleAuth } from '@/lib/server/controllers/core/authController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, googleAuth, { rateLimit: 'auth' });
  } catch (error) {
    console.error('[/api/auth/google]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
