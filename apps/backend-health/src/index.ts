import express from 'express';
import cors from 'cors';
import './config';

import nutritionRoutes from './routes/nutrition';
import workoutRoutes from './routes/workouts';
import statsRoutes from './routes/stats';
import internalRoutes from './routes/internal';
import fatsecretRoutes from './routes/fatsecret';
import customFoodsRoutes from './routes/customFoods';
import stravaRoutes from './routes/strava';

const app = express();
const port = process.env.PORT || 3002;
const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

// ── Global Middleware ─────────────────────────────────────────────────────────

app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : false }));
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
    res.json({ service: 'backend-health', status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public API Routes (JWT-protected internally) ──────────────────────────────

app.use('/api/nutrition/custom-foods', customFoodsRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/fatsecret', fatsecretRoutes);
app.use('/api/strava', stravaRoutes);

// ── Internal Routes (API-key-protected) ──────────────────────────────────────

app.use('/internal', internalRoutes);

app.listen(Number(port), '0.0.0.0', () => {
    console.log(`[backend-health] Service running on port ${port} (IPv4)`);
});
