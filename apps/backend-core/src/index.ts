import express from 'express';
import cors from 'cors';
import './config';

import authRoutes from './routes/auth';
import challengeRoutes from './routes/challenges';
import logRoutes from './routes/logs';
import questRoutes from './routes/quests';
import usersRoutes from './routes/users';

const app = express();
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

app.use(cors({
    origin: (origin, callback) => {
        // Requests without an Origin (health checks, curl, service-to-service)
        // are not subject to browser CORS and should continue to work.
        callback(null, origin && allowedOrigins.includes(origin) ? origin : false);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Profile images are sent as optimized data URLs by the profile editor.
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/users', usersRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
