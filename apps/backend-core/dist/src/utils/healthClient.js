"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyHealthSummary = getDailyHealthSummary;
const HEALTH_SERVICE_URL = process.env.HEALTH_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';
/**
 * Fetches the health compliance summary for a given user and date
 * from the backend-health microservice.
 *
 * @throws Error if the health service is unreachable or returns an error status
 */
async function getDailyHealthSummary(userId, date) {
    const url = `${HEALTH_SERVICE_URL}/internal/summary/${userId}/${date}`;
    const response = await fetch(url, {
        headers: {
            'x-internal-api-key': INTERNAL_API_KEY,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Health service returned ${response.status} for ${userId}/${date}: ${errorBody}`);
    }
    return response.json();
}
