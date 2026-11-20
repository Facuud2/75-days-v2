import express from 'express';
import cors from 'cors';
import './config';

import authRoutes from './routes/auth';
import challengeRoutes from './routes/challenges';
import logRoutes from './routes/logs';
import questRoutes from './routes/quests';
import usersRoutes from './routes/users';
import aiRoutes from './routes/ai';
import syncRoutes from './routes/sync';
import { fetchCachedAvailableQuestTemplates } from './controllers/questController';
import {
    configureServerLifecycle,
    isDbWarmed,
    warmupDatabaseAndCaches,
} from './utils/dbLifecycle';
import { securityHeaders } from './middlewares/securityHeaders';

const app = express();
app.disable('x-powered-by');
const port = process.env.PORT || 3001;
const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
// Keep production usable even if Render's FRONTEND_URL is accidentally omitted.
// Additional preview/custom origins must still be supplied through FRONTEND_URL.
const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : [
        'https://75-days-v2.vercel.app',
        ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
    ];

app.use(securityHeaders);
app.use(cors({
    origin: (origin, callback) => {
        // Requests without an Origin (health checks, curl, service-to-service)
        // are not subject to browser CORS and should continue to work.
        callback(null, origin && allowedOrigins.includes(origin) ? origin : false);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Cache preflight OPTIONS responses for 24h to save a full RTT on mutations
    maxAge: 86_400,
}));
// Profile images are sent as optimized data URLs by the profile editor.
app.use(express.json({ limit: '5mb' }));

app.get('/health', async (req, res) => {
    if (req.query?.deep === '1') {
        const ok = await warmupDatabaseAndCaches();
        return res.status(ok ? 200 : 503).json({
            service: 'backend-core',
            status: ok ? 'ok' : 'degraded',
            dbWarmed: ok,
        });
    }
    res.json({ status: 'ok', dbWarmed: isDbWarmed() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/sync', syncRoutes);

if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const devRoutes = require('./routes/dev').default;
    app.use('/api/dev', devRoutes);
}

// Global error handler — never expose internal stack traces to clients
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[backend-core] Unhandled error:', err);
    if (!res.headersSent) {
        const status = typeof err?.status === 'number' ? err.status : 500;
        const message = status < 500 && err?.message ? err.message : 'Internal server error';
        res.status(status).json({ error: message });
    }
});

const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    void warmupDatabaseAndCaches(() => fetchCachedAvailableQuestTemplates());
});

configureServerLifecycle(server, 'backend-core');
