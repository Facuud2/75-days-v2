import { Router } from 'express';
import { createCustomFood, getCustomFoods, updateCustomFood, deleteCustomFood, getSystemIngredients } from '../controllers/customFoodController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Protect all routes with JWT middleware
router.use(authenticate);

router.get('/ingredients', getSystemIngredients); // MUST be before /:id
router.post('/', createCustomFood);
router.get('/', getCustomFoods);
router.put('/:id', updateCustomFood);
router.delete('/:id', deleteCustomFood);

export default router;
