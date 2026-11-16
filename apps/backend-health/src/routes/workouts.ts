import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
    logWorkout,
    getRecentWorkouts,
    getWorkoutsForDay,
    deleteWorkout,
    updateWorkout,
} from '../controllers/workoutController';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(logWorkout));
router.get('/recent', asyncHandler(getRecentWorkouts));
router.get('/:date', asyncHandler(getWorkoutsForDay));
router.put('/:id', asyncHandler(updateWorkout));
router.delete('/:id', asyncHandler(deleteWorkout));

export default router;
