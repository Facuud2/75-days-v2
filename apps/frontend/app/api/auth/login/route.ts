import { handleRoute } from '@/lib/server/http';
import { login } from '@/lib/server/controllers/core/authController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, login, { rateLimit: 'auth' });
  } catch (error) {
    console.error('[/api/auth/login]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
