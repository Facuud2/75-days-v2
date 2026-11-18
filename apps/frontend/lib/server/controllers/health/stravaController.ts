import axios from 'axios';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { estimateCaloriesBurned } from '../../utils/calorieCalculator';

export const connectStrava = (req: ControllerRequest, res: ControllerResponse) => {
  try {
    const stravaClientId = process.env.STRAVA_CLIENT_ID;
    const stravaRedirectUri =
      process.env.STRAVA_REDIRECT_URI ||
      'http://localhost:3000/api/strava/callback';

    if (!stravaClientId) {
      return res
        .status(500)
        .json({ error: 'Strava Client ID no configurado en el servidor' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&response_type=code&redirect_uri=${encodeURIComponent(stravaRedirectUri)}&approval_prompt=force&scope=read,activity:read_all&state=${userId}`;

    return res.json({ url: authUrl });
  } catch (error) {
    console.error('[stravaController.connectStrava]', error);
    return res.status(500).json({ error: 'Fallo al generar la URL de Strava.' });
  }
};

export const stravaCallback = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  const frontendUrl = process.env.FRONTEND_URL || new URL(req.rawRequest.url).origin;
  try {
    const prisma = getHealthPrisma();
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Código de autorización faltante' });
    }

    if (!state || typeof state !== 'string') {
      return res
        .status(400)
        .json({ error: 'ID de usuario (state) faltante o inválido' });
    }

    const userId = state;

    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_at, athlete } = response.data;

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
      },
    });

    return res.redirect(`${frontendUrl}/profile?strava=success`);
  } catch (error) {
    console.error('[stravaController.stravaCallback]', error);
    return res.redirect(`${frontendUrl}/profile?strava=error`);
  }
};

export const getStravaStatus = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getHealthPrisma();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const profile = await prisma.userHealthProfile.findUnique({
      where: { userId },
    });

    if (!profile || !profile.stravaAccessToken) {
      return res.json({ connected: false });
    }

    return res.json({ connected: true });
  } catch (error) {
    console.error('[stravaController.getStravaStatus]', error);
    return res
      .status(500)
      .json({ error: 'Fallo al verificar el estado de Strava' });
  }
};

const refreshStravaTokenIfNeeded = async (profile: any) => {
  const prisma = getHealthPrisma();
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (
    profile.stravaTokenExpiresAt &&
    profile.stravaTokenExpiresAt < nowInSeconds + 300
  ) {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: profile.stravaRefreshToken,
    });

    const { access_token, refresh_token, expires_at } = response.data;

    await prisma.userHealthProfile.update({
      where: { id: profile.id },
      data: {
        stravaAccessToken: access_token,
        stravaRefreshToken: refresh_token,
        stravaTokenExpiresAt: expires_at,
      },
    });

    return access_token;
  }

  return profile.stravaAccessToken;
};

export const syncStravaWorkouts = async (
  req: ControllerRequest,
  res: ControllerResponse
) => {
  try {
    const prisma = getHealthPrisma();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const profile = await prisma.userHealthProfile.findUnique({
      where: { userId },
    });

    if (!profile || !profile.stravaAccessToken) {
      return res.status(400).json({ error: 'Strava no está conectado' });
    }

    const accessToken = await refreshStravaTokenIfNeeded(profile);

    const thirtyDaysAgoInfo = new Date();
    thirtyDaysAgoInfo.setDate(thirtyDaysAgoInfo.getDate() - 30);
    const afterEpoch = Math.floor(thirtyDaysAgoInfo.getTime() / 1000);

    const response = await axios.get(
      `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=30`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const activities = Array.isArray(response.data) ? response.data : [];
    let syncedCount = 0;

    if (activities.length > 0) {
      const externalIds = activities.map((a: any) => String(a.id));

      const existingEntries = await prisma.workoutEntry.findMany({
        where: { externalId: { in: externalIds } },
        select: { externalId: true },
      });
      const existingSet = new Set(existingEntries.map((e) => e.externalId));

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
        const created = await prisma.workoutEntry.createMany({
          data: newWorkoutsData,
          skipDuplicates: true,
        });
        syncedCount = created.count;
      }
    }

    return res.json({
      success: true,
      message: `Sincronizados ${syncedCount} entrenamientos de Strava.`,
      count: syncedCount,
    });
  } catch (error: any) {
    console.error('[stravaController.syncStravaWorkouts]', error?.response?.data || error);
    return res.status(500).json({ error: 'Fallo al sincronizar con Strava' });
  }
};
