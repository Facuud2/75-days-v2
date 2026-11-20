import { handleRoute } from '@/lib/server/http';
import { updatePassword } from '@/lib/server/controllers/core/userController';

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, updatePassword, {
      auth: true,
      rateLimit: 'sensitive',
    });
  } catch (error) {
    console.error('[/api/users/password]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
