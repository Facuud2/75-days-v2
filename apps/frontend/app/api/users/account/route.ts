import { handleRoute } from '@/lib/server/http';
import { deleteAccount } from '@/lib/server/controllers/core/userController';

export async function DELETE(req: Request, context: any) {
  try {
    return await handleRoute(req, context, deleteAccount, {
      auth: true,
      rateLimit: 'sensitive',
    });
  } catch (error) {
    console.error('[/api/users/account]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
