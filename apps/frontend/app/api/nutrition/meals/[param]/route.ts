import { handleRoute } from '@/lib/server/http';
import {
  deleteMeal,
  editMeal,
  getMealsForDay,
} from '@/lib/server/controllers/health/nutritionController';

export async function GET(req: Request, context: any) {
  try {
    return await handleRoute(req, context, getMealsForDay, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/meals/[param] GET]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: Request, context: any) {
  try {
    return await handleRoute(req, context, editMeal, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/meals/[param] PUT]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: any) {
  try {
    return await handleRoute(req, context, deleteMeal, { auth: true });
  } catch (error) {
    console.error('[/api/nutrition/meals/[param] DELETE]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
