import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
    logWorkout,
    getRecentWorkouts,
    getWorkoutsForDay,
    deleteWorkout,
    updateWorkout,
} from '../controllers/workoutController';

const router = Router();

router.use(authenticate);

router.post('/', logWorkout);
router.get('/recent', getRecentWorkouts);
router.get('/:date', getWorkoutsForDay);
router.put('/:id', updateWorkout);
router.delete('/:id', deleteWorkout);

export default router;
