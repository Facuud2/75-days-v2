import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
    logMeal,
    getMealsForDay,
    deleteMeal,
    editMeal,
    upsertGoals,
    getGoals,
} from '../controllers/nutritionController';

const router = Router();

// All nutrition routes require a valid JWT
router.use(authenticate);

router.post('/meals', asyncHandler(logMeal));
router.get('/meals/:date', asyncHandler(getMealsForDay));
router.put('/meals/:id', asyncHandler(editMeal));
router.delete('/meals/:id', asyncHandler(deleteMeal));
router.put('/goals', asyncHandler(upsertGoals));
router.get('/goals', asyncHandler(getGoals));

export default router;
