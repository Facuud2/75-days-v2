import { handleRoute } from '@/lib/server/http';
import {
  createCustomFood,
  getCustomFoods,
} from '@/lib/server/controllers/health/customFoodController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getCustomFoods, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/custom-foods GET]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request, context: any) {
  try {
    return await handleRoute(req, context, createCustomFood, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/custom-foods POST]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
