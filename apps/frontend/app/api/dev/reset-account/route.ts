import { handleRoute } from '@/lib/server/http';
import { resetAccount } from '@/lib/server/controllers/core/devController';

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, resetAccount, {
      auth: true,
      devOnly: true,
    });
  } catch (error) {
    console.error('[/api/dev/reset-account]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
