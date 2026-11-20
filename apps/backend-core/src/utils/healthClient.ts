/**
 * healthClient.ts
 *
 * HTTP client for communicating with the backend-health microservice
 * via its internal (API-key-protected) endpoints.
 *
 * Usage (in backend-core controllers):
 *   import { getDailyHealthSummary } from '../utils/healthClient';
 *   const summary = await getDailyHealthSummary(userId, '2026-03-07');
 */

const HEALTH_SERVICE_URL = (process.env.HEALTH_SERVICE_URL || 'http://localhost:3002').replace(/\/+$/, '');
const INTERNAL_HTTP_TIMEOUT_MS = 5_000;
import { config } from '../config';

export interface HealthDaySummary {
    userId: string;
    date: string;
    dietCompliant: boolean;
    workoutCompliant: boolean;
    details: {
        consumed: number;
        dailyCalorieGoal: number;
        totalWorkoutMin: number;
        requiredWorkoutMin: number;
        mealsLogged: number;
        workoutsLogged: number;
    };
}

export interface HealthUserExport {
    profile: Record<string, unknown> | null;
    meals: Record<string, unknown>[];
    workouts: Record<string, unknown>[];
    customFoods: Record<string, unknown>[];
}

/**
 * Fetches the health compliance summary for a given user and date
 * from the backend-health microservice.
 *
 * @throws Error if the health service is unreachable or returns an error status
 */
export async function getDailyHealthSummary(
    userId: string,
    date: string
): Promise<HealthDaySummary> {
    const url = `${HEALTH_SERVICE_URL}/internal/summary/${encodeURIComponent(userId)}/${encodeURIComponent(date)}`;

    const response = await fetch(url, {
        signal: AbortSignal.timeout(INTERNAL_HTTP_TIMEOUT_MS),
        headers: {
            'x-internal-api-key': config.internalApiKey,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `Health service returned ${response.status} for ${userId}/${date}: ${errorBody}`
        );
    }

    return response.json() as Promise<HealthDaySummary>;
}

/**
 * Purges all health-domain data for a user in backend-health when deleting an account.
 */
export async function deleteUserHealthData(userId: string): Promise<void> {
    const url = `${HEALTH_SERVICE_URL}/internal/users/${encodeURIComponent(userId)}`;

    const response = await fetch(url, {
        method: 'DELETE',
        signal: AbortSignal.timeout(INTERNAL_HTTP_TIMEOUT_MS),
        headers: {
            'x-internal-api-key': config.internalApiKey,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Health service delete failed (${response.status}): ${errorBody}`);
    }
}

/**
 * Exports all sanitized health-domain records for a user from backend-health.
 */
export async function exportUserHealthData(userId: string): Promise<HealthUserExport> {
    const url = `${HEALTH_SERVICE_URL}/internal/users/${encodeURIComponent(userId)}/export`;

    const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(INTERNAL_HTTP_TIMEOUT_MS),
        headers: {
            'x-internal-api-key': config.internalApiKey,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Health service export failed (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<HealthUserExport>;
}

export const healthClient = {
    getDailyHealthSummary,
    deleteUserHealthData,
    exportUserHealthData,
};
