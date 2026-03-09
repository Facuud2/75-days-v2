import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
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

router.post('/meals', logMeal);
router.get('/meals/:date', getMealsForDay);
router.put('/meals/:id', editMeal);
router.delete('/meals/:id', deleteMeal);
router.put('/goals', upsertGoals);
router.get('/goals', getGoals);

export default router;
