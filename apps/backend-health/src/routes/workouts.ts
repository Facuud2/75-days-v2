import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
    logWorkout,
    getWorkoutsForDay,
    deleteWorkout,
} from '../controllers/workoutController';

const router = Router();

router.use(authenticate);

router.post('/', logWorkout);
router.get('/:date', getWorkoutsForDay);
router.delete('/:id', deleteWorkout);

export default router;
