import { handleRoute } from '@/lib/server/http';
import {
  deleteCustomFood,
  updateCustomFood,
} from '@/lib/server/controllers/health/customFoodController';

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, updateCustomFood, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/custom-foods/[id] PUT]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: any) {
  try {
    return await handleRoute(req, context, deleteCustomFood, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/custom-foods/[id] DELETE]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
