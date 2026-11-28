import axios from 'axios';
import crypto from 'crypto';
import { getHealthPrisma } from '../../db';
import { ControllerRequest, ControllerResponse } from '../../http';
import { estimateCaloriesBurned } from '../../utils/calorieCalculator';
import {
  decryptSecret,
  encryptSecret,
  signOAuthStateWithNonce,
  verifyOAuthStatePayload,
} from '../../utils/tokenCrypto';

const STRAVA_TIMEOUT_MS = 5_000;
const STRAVA_NONCE_COOKIE = 'strava_oauth_nonce';

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

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

    // F-14: Signed short-lived state + HttpOnly SameSite=Lax browser cookie prevents account-linking CSRF
    const { state: signedState, nonce } = signOAuthStateWithNonce(userId);
    const secureAttr = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${STRAVA_NONCE_COOKIE}=${encodeURIComponent(nonce)}; HttpOnly; SameSite=Lax; Path=/api/strava/callback; Max-Age=600${secureAttr}`
    );

    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&response_type=code&redirect_uri=${encodeURIComponent(stravaRedirectUri)}&approval_prompt=force&scope=read,activity:read_all&state=${encodeURIComponent(signedState)}`;

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
  const rawFrontend = (
    process.env.FRONTEND_URL || new URL(req.rawRequest.url).origin
  )
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '');
  const frontendUrl = rawFrontend || new URL(req.rawRequest.url).origin;
  const clearNonceCookie = () => {
    const secureAttr = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${STRAVA_NONCE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/strava/callback; Max-Age=0${secureAttr}`
    );
  };
  try {
    const { code, state } = req.query;

    if (!code) {
      clearNonceCookie();
      return res.status(400).json({ error: 'Código de autorización faltante' });
    }

    if (!state || typeof state !== 'string') {
      clearNonceCookie();
      return res
        .status(400)
        .json({ error: 'Parámetro state faltante o inválido' });
    }

    // F-14: Verify HMAC/JWT signature on state AND browser-bound CSRF nonce cookie
    const payload = verifyOAuthStatePayload(state);
    const cookieNonce = parseCookieValue(req.headers.cookie, STRAVA_NONCE_COOKIE);
    clearNonceCookie();
    if (!payload || !cookieNonce || !timingSafeEqualStr(payload.nonce, cookieNonce)) {
      return res
        .status(400)
        .json({ error: 'Parámetro state inválido, expirado o sesión CSRF no coincide' });
    }
    const userId = payload.userId;
    const prisma = getHealthPrisma();

    const response = await axios.post(
      'https://www.strava.com/oauth/token',
      {
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      },
      { timeout: STRAVA_TIMEOUT_MS }
    );

    const { access_token, refresh_token, expires_at, athlete } = response.data;
    // F-15: Encrypt tokens at rest
    const encryptedAccess = encryptSecret(access_token);
    const encryptedRefresh = encryptSecret(refresh_token);

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
    const plainRefreshToken = decryptSecret(profile.stravaRefreshToken);
    const response = await axios.post(
      'https://www.strava.com/oauth/token',
      {
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: plainRefreshToken,
      },
      { timeout: STRAVA_TIMEOUT_MS }
    );

    const { access_token, refresh_token, expires_at } = response.data;

    await prisma.userHealthProfile.update({
      where: { id: profile.id },
      data: {
        stravaAccessToken: encryptSecret(access_token),
        stravaRefreshToken: encryptSecret(refresh_token),
        stravaTokenExpiresAt: expires_at,
      },
    });

    return access_token;
  }

  return decryptSecret(profile.stravaAccessToken);
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
        timeout: STRAVA_TIMEOUT_MS,
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
        where: { userId, externalId: { in: externalIds } },
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
