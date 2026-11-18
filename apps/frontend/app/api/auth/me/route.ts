import { handleRoute } from '@/lib/server/http';
import { getMe } from '@/lib/server/controllers/core/authController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getMe, { auth: true });
  } catch (error) {
    console.error('[/api/auth/me]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
