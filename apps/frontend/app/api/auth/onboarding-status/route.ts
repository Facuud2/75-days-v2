import { handleRoute } from '@/lib/server/http';
import { getOnboardingStatus } from '@/lib/server/controllers/core/authController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getOnboardingStatus, { auth: true });
  } catch (error) {
    console.error('[/api/auth/onboarding-status]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
