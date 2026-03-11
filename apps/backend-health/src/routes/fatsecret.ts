import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { getFoodController, importFoodController, searchFoodController } from '../controllers/fatsecretController';

const router = Router();

// Protect all FatSecret proxy routes with user authentication
router.use(authenticate);

// GET /api/fatsecret/search?query=banana
router.get('/search', searchFoodController);

// GET /api/fatsecret/food/:id
router.get('/food/:id', getFoodController);

// POST /api/fatsecret/import/:id
router.post('/import/:id', importFoodController);

export default router;
