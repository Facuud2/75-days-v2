import { handleRoute } from '@/lib/server/http';
import { getProfile, updateProfile } from '@/lib/server/controllers/core/userController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getProfile, { auth: true });
  } catch (error) {
    console.error('[/api/users/profile GET]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, updateProfile, { auth: true });
  } catch (error) {
    console.error('[/api/users/profile PUT]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
