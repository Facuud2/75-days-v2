import { handleRoute } from '@/lib/server/http';
import { exportUserData } from '@/lib/server/controllers/core/userController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, exportUserData, {
      auth: true,
      rateLimit: 'sensitive',
    });
  } catch (error) {
    console.error('[/api/users/export]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
