import { Router } from 'express';
import {
    createCustomFood,
    getCustomFoods,
    updateCustomFood,
    deleteCustomFood,
    getSystemIngredients,
} from '../controllers/customFoodController';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Protect all routes with JWT middleware
router.use(authenticate);

router.get('/ingredients', asyncHandler(getSystemIngredients)); // MUST be before /:id
router.post('/', asyncHandler(createCustomFood));
router.get('/', asyncHandler(getCustomFoods));
router.put('/:id', asyncHandler(updateCustomFood));
router.delete('/:id', asyncHandler(deleteCustomFood));

export default router;
