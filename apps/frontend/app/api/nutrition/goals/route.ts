import { handleRoute } from '@/lib/server/http';
import {
  getGoals,
  upsertGoals,
} from '@/lib/server/controllers/health/nutritionController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getGoals, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/goals GET]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, upsertGoals, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/goals PUT]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
