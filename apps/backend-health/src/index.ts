import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import nutritionRoutes from './routes/nutrition';
import workoutRoutes from './routes/workouts';
import statsRoutes from './routes/stats';
import internalRoutes from './routes/internal';
import fatsecretRoutes from './routes/fatsecret';

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
app.use('/api/fatsecret', fatsecretRoutes);

// ── Internal Routes (API-key-protected) ──────────────────────────────────────

app.use('/internal', internalRoutes);

app.listen(Number(port), '0.0.0.0', () => {
    console.log(`[backend-health] Service running on port ${port} (IPv4)`);
});
