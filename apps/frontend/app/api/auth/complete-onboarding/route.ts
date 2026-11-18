import { handleRoute } from '@/lib/server/http';
import { completeOnboarding } from '@/lib/server/controllers/core/authController';

export async function PATCH(req: Request, context: any) {
  try {
    return await handleRoute(req, context, completeOnboarding, { auth: true });
  } catch (error) {
    console.error('[/api/auth/complete-onboarding]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
