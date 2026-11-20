import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';
import { estimateCaloriesBurned } from '../utils/calorieCalculator';
import {
    decryptSecret,
    encryptSecret,
    signOAuthState,
    verifyOAuthState,
} from '../utils/tokenCrypto';

const STRAVA_TIMEOUT_MS = 5_000;

const getStravaClientId = () => process.env.STRAVA_CLIENT_ID;
const getStravaClientSecret = () => process.env.STRAVA_CLIENT_SECRET;
const getStravaRedirectUri = () =>
    process.env.STRAVA_REDIRECT_URI || 'http://localhost:3002/api/strava/callback';
const getSafeFrontendBaseUrl = () => {
    const raw = (process.env.FRONTEND_URL || 'http://localhost:3000')
        .split(',')[0]
        .trim()
        .replace(/\/+$/, '');
    return raw || 'http://localhost:3000';
};

export const connectStrava = (req: AuthRequest, res: Response) => {
    try {
        const clientId = getStravaClientId();
        if (!clientId) {
            return res.status(500).json({ error: 'Strava Client ID no configurado en el servidor' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        // F-14: Signed short-lived OAuth state prevents CSRF account-linking attacks
        const signedState = signOAuthState(userId);
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(getStravaRedirectUri())}&approval_prompt=force&scope=read,activity:read_all&state=${encodeURIComponent(signedState)}`;

        res.json({ url: authUrl });
    } catch (error) {
        console.error('Error generating Strava Auth URL:', error);
        res.status(500).json({ error: 'Fallo al generar la URL de Strava.' });
    }
};

export const stravaCallback = async (req: Request, res: Response) => {
    const frontendUrl = getSafeFrontendBaseUrl();
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Código de autorización faltante' });
        }

        if (!state || typeof state !== 'string') {
            return res.status(400).json({ error: 'Parámetro state faltante o inválido' });
        }

        // F-14: Verify HMAC/JWT signature on state — reject raw or tampered userIds
        const userId = verifyOAuthState(state);
        if (!userId) {
            return res.status(400).json({ error: 'Parámetro state inválido o expirado' });
        }

        // Intercambiar el código por tokens (con timeout explícito)
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: getStravaClientId(),
            client_secret: getStravaClientSecret(),
            code,
            grant_type: 'authorization_code'
        }, { timeout: STRAVA_TIMEOUT_MS });

        const { access_token, refresh_token, expires_at, athlete } = response.data;
        // F-15: Encrypt third-party OAuth tokens at rest before storing in Postgres
        const encryptedAccess = encryptSecret(access_token);
        const encryptedRefresh = encryptSecret(refresh_token);

        // Guardar/Actualizar en la base de datos
        await prisma.userHealthProfile.upsert({
            where: { userId },
            update: {
                stravaAccessToken: encryptedAccess,
                stravaRefreshToken: encryptedRefresh,
                stravaTokenExpiresAt: expires_at,
                stravaAthleteId: athlete.id.toString(),
            },
            create: {
                userId,
                stravaAccessToken: encryptedAccess,
                stravaRefreshToken: encryptedRefresh,
                stravaTokenExpiresAt: expires_at,
                stravaAthleteId: athlete.id.toString(),
            }
        });

        res.redirect(`${frontendUrl}/profile?strava=success`);

    } catch (error) {
        console.error('Error in Strava callback:', error);
        res.redirect(`${frontendUrl}/profile?strava=error`);
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
        const plainRefreshToken = decryptSecret(profile.stravaRefreshToken);
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: getStravaClientId(),
            client_secret: getStravaClientSecret(),
            grant_type: 'refresh_token',
            refresh_token: plainRefreshToken
        }, { timeout: STRAVA_TIMEOUT_MS });

        const { access_token, refresh_token, expires_at } = response.data;

        await prisma.userHealthProfile.update({
            where: { id: profile.id },
            data: {
                stravaAccessToken: encryptSecret(access_token),
                stravaRefreshToken: encryptSecret(refresh_token),
                stravaTokenExpiresAt: expires_at
            }
        });

        return access_token;
    }

    return decryptSecret(profile.stravaAccessToken);
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
            timeout: STRAVA_TIMEOUT_MS,
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const activities = Array.isArray(response.data) ? response.data : [];
        let syncedCount = 0;

        if (activities.length > 0) {
            const externalIds = activities.map((a: any) => String(a.id));

            // Fase 3: 1 única lectura en lote en lugar de N consultas findUnique secuenciales
            const existingEntries = await prisma.workoutEntry.findMany({
                where: { externalId: { in: externalIds } },
                select: { externalId: true },
            });
            const existingSet = new Set(existingEntries.map((e) => e.externalId));

            // Reutiliza el perfil ya leído arriba en vez de consultarlo 30 veces dentro del loop
            const weightKg = profile.weightKg ?? 70;
            const heightCm = (profile as any).heightCm ?? 170;

            const newWorkoutsData = activities
                .filter((activity: any) => !existingSet.has(String(activity.id)))
                .map((activity: any) => {
                    const externalId = String(activity.id);
                    let sport = 'other';
                    const lowerType = String(activity.type || '').toLowerCase();
                    if (lowerType.includes('run')) sport = 'running';
                    else if (
                        lowerType.includes('ride') ||
                        lowerType.includes('bike') ||
                        lowerType.includes('cycling')
                    ) {
                        sport = 'cycling';
                    } else if (lowerType.includes('swim')) sport = 'swimming';
                    else if (lowerType.includes('weight') || lowerType.includes('workout')) {
                        sport = 'strength';
                    } else if (lowerType.includes('yoga')) sport = 'yoga';
                    else if (lowerType.includes('walk')) sport = 'walking';

                    let intensity = 'medium';
                    if (activity.suffer_score) {
                        if (activity.suffer_score > 100) intensity = 'high';
                        else if (activity.suffer_score < 30) intensity = 'low';
                    }

                    const durationMin = Math.max(1, Math.round((activity.moving_time || 60) / 60));
                    const estimatedCals = estimateCaloriesBurned(
                        sport,
                        durationMin,
                        intensity,
                        weightKg,
                        heightCm
                    );

                    return {
                        userId,
                        date: String(activity.start_date_local || '').split('T')[0],
                        sport,
                        durationMin,
                        intensity,
                        caloriesBurned: activity.kilojoules
                            ? activity.kilojoules * 0.239006
                            : estimatedCals,
                        isManualCalories: false,
                        distanceKm: Number(((activity.distance || 0) / 1000).toFixed(2)),
                        source: 'strava',
                        externalId,
                        notes: activity.name ?? null,
                    };
                });

            if (newWorkoutsData.length > 0) {
                // Fase 3: 1 único INSERT en lote (createMany) en lugar de N inserts secuenciales
                const created = await prisma.workoutEntry.createMany({
                    data: newWorkoutsData,
                    skipDuplicates: true,
                });
                syncedCount = created.count;
            }
        }

        res.json({ success: true, message: `Sincronizados ${syncedCount} entrenamientos de Strava.`, count: syncedCount });

    } catch (error: any) {
        console.error('Error syncing Strava workouts:', error?.response?.data || error);
        res.status(500).json({ error: 'Fallo al sincronizar con Strava' });
    }
};
