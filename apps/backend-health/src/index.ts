import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nutritionRoutes from './routes/nutrition';
import workoutRoutes from './routes/workouts';
import statsRoutes from './routes/stats';
import internalRoutes from './routes/internal';

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

// ── Global Middleware ─────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
    res.json({ service: 'backend-health', status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public API Routes (JWT-protected internally) ──────────────────────────────

app.use('/api/nutrition', nutritionRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/stats', statsRoutes);

// ── Internal Routes (API-key-protected) ──────────────────────────────────────

app.use('/internal', internalRoutes);

// ── Global Error Handler ──────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[backend-health] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(port, () => {
    console.log(`[backend-health] Service running on port ${port}`);
});
