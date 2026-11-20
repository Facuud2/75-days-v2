import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { externalApiRateLimit } from '../middlewares/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { getFoodController, importFoodController, searchFoodController } from '../controllers/fatsecretController';

const router = Router();

// Protect all FatSecret proxy routes with user authentication and external API rate limiting
router.use(authenticate);
router.use(externalApiRateLimit);

// GET /api/fatsecret/search?query=banana
router.get('/search', asyncHandler(searchFoodController));

// GET /api/fatsecret/food/:id
router.get('/food/:id', asyncHandler(getFoodController));

// POST /api/fatsecret/import/:id
router.post('/import/:id', asyncHandler(importFoodController));

export default router;
