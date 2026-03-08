import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { searchFoodController, getFoodController } from '../controllers/fatsecretController';

const router = Router();

// Protect all FatSecret proxy routes with user authentication
router.use(authenticate);

// GET /api/fatsecret/search?query=banana
router.get('/search', searchFoodController);

// GET /api/fatsecret/food/:id
router.get('/food/:id', getFoodController);

export default router;
