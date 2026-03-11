import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { AuthRequest } from '../middlewares/auth';
import { estimateCaloriesBurned } from '../utils/calorieCalculator';

const prisma = new PrismaClient();

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || 'http://localhost:3002/api/strava/callback';

export const connectStrava = (req: AuthRequest, res: Response) => {
    try {
        if (!STRAVA_CLIENT_ID) {
            return res.status(500).json({ error: 'Strava Client ID no configurado en el servidor' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        // State can be the user ID so we know who authorized it in the callback
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=force&scope=read,activity:read_all&state=${userId}`;

        res.json({ url: authUrl });
    } catch (error) {
        console.error('Error generating Strava Auth URL:', error);
        res.status(500).json({ error: 'Fallo al generar la URL de Strava.' });
    }
};

export const stravaCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query; // State contains the userId passed from the frontend

        if (!code) {
            return res.status(400).json({ error: 'Código de autorización faltante' });
        }

        if (!state || typeof state !== 'string') {
            return res.status(400).json({ error: 'ID de usuario (state) faltante o inválido' });
        }

        const userId = state;

        // Intercambiar el código por tokens
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code'
        });

        const { access_token, refresh_token, expires_at, athlete } = response.data;

        // Guardar/Actualizar en la base de datos
        await prisma.userHealthProfile.upsert({
            where: { userId },
            update: {
                stravaAccessToken: access_token,
                stravaRefreshToken: refresh_token,
                stravaTokenExpiresAt: expires_at,
                stravaAthleteId: athlete.id.toString(),
            },
            create: {
                userId,
                stravaAccessToken: access_token,
                stravaRefreshToken: refresh_token,
                stravaTokenExpiresAt: expires_at,
                stravaAthleteId: athlete.id.toString(),
            }
        });

        // Redirect back to frontend profile page
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${FRONTEND_URL}/profile?strava=success`);

    } catch (error) {
        console.error('Error in Strava callback:', error);
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${FRONTEND_URL}/profile?strava=error`);
    }
};

export const getStravaStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const profile = await prisma.userHealthProfile.findUnique({
            where: { userId }
        });

        if (!profile || !profile.stravaAccessToken) {
            return res.json({ connected: false });
        }

        res.json({ connected: true });
    } catch (error) {
        console.error('Error checking Strava status:', error);
        res.status(500).json({ error: 'Fallo al verificar el estado de Strava' });
    }
};

const refreshStravaTokenIfNeeded = async (profile: any) => {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    // Si expira en menos de 5 minutos, refrescar
    if (profile.stravaTokenExpiresAt && profile.stravaTokenExpiresAt < nowInSeconds + 300) {
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: profile.stravaRefreshToken
        });

        const { access_token, refresh_token, expires_at } = response.data;

        await prisma.userHealthProfile.update({
            where: { id: profile.id },
            data: {
                stravaAccessToken: access_token,
                stravaRefreshToken: refresh_token,
                stravaTokenExpiresAt: expires_at
            }
        });

        return access_token;
    }

    return profile.stravaAccessToken;
};

export const syncStravaWorkouts = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const profile = await prisma.userHealthProfile.findUnique({
            where: { userId }
        });

        if (!profile || !profile.stravaAccessToken) {
            return res.status(400).json({ error: 'Strava no está conectado' });
        }

        // Verificar y refrescar token si es necesario
        const accessToken = await refreshStravaTokenIfNeeded(profile);

        // Obtener actividades recientes de Strava (últimos 30 días)
        const thirtyDaysAgoInfo = new Date();
        thirtyDaysAgoInfo.setDate(thirtyDaysAgoInfo.getDate() - 30);
        const afterEpoch = Math.floor(thirtyDaysAgoInfo.getTime() / 1000);

        const response = await axios.get(`https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=30`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const activities = response.data;
        let syncedCount = 0;

        for (const activity of activities) {
            const externalId = activity.id.toString();

            // Verificar si ya existe
            const existing = await prisma.workoutEntry.findUnique({
                where: { externalId }
            });

            if (!existing) {
                // Determine sport from Strava type
                let sport = 'other';
                const lowerType = activity.type.toLowerCase();
                if (lowerType.includes('run')) sport = 'running';
                else if (lowerType.includes('ride') || lowerType.includes('bike') || lowerType.includes('cycling')) sport = 'cycling';
                else if (lowerType.includes('swim')) sport = 'swimming';
                else if (lowerType.includes('weight') || lowerType.includes('workout')) sport = 'strength';
                else if (lowerType.includes('yoga')) sport = 'yoga';
                else if (lowerType.includes('walk')) sport = 'walking';

                // Determinar intensidad rudimentaria (basada en el score de sufrimiento si existe o defecto a medium)
                let intensity = 'medium';
                if (activity.suffer_score) {
                    if (activity.suffer_score > 100) intensity = 'high';
                    else if (activity.suffer_score < 30) intensity = 'low';
                }

                const durationMin = Math.round(activity.moving_time / 60);

                const profile = await prisma.userHealthProfile.findUnique({ where: { userId } });
                const weightKg = profile?.weightKg ?? 70;
                // @ts-ignore: Bypass IDE Prisma cache
                const heightCm = (profile as any)?.heightCm ?? 170;

                const estimatedCals = estimateCaloriesBurned(sport, durationMin, intensity, weightKg, heightCm);

                await prisma.workoutEntry.create({
                    data: {
                        userId,
                        date: activity.start_date_local.split('T')[0],
                        sport,
                        durationMin,
                        intensity,
                        caloriesBurned: activity.kilojoules ? (activity.kilojoules * 0.239006) : estimatedCals,
                        isManualCalories: false,
                        distanceKm: Number((activity.distance / 1000).toFixed(2)),
                        source: 'strava',
                        externalId: externalId,
                        notes: activity.name,
                    }
                });
                syncedCount++;
            }
        }

        res.json({ success: true, message: `Sincronizados ${syncedCount} entrenamientos de Strava.`, count: syncedCount });

    } catch (error: any) {
        console.error('Error syncing Strava workouts:', error?.response?.data || error);
        res.status(500).json({ error: 'Fallo al sincronizar con Strava' });
    }
};
