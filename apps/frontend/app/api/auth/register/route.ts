import { handleRoute } from '@/lib/server/http';
import { register } from '@/lib/server/controllers/core/authController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, register, { rateLimit: 'auth' });
  } catch (error) {
    console.error('[/api/auth/register]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
