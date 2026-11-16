import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { completeChallenge, resetAccount, timeTravel } from '../controllers/devController';

const router = Router();

// Doble barrera: este router nunca debe responder en producción.
router.use((_req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
});

router.use(authenticate);

router.post('/time-travel', timeTravel);
router.post('/complete-challenge', completeChallenge);
router.post('/reset-account', resetAccount);

export default router;
