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
const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : false }));
app.use(express.json());

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
