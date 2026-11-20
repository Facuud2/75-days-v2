import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../lib/prisma';
import { config } from '../config';
import { internalAuth } from '../middlewares/internalAuth';
import { createRateLimiter } from '../middlewares/rateLimit';
import { deleteMeal, editMeal, getGoals, logMeal, upsertGoals } from '../controllers/nutritionController';
import { deleteWorkout, logWorkout, updateWorkout } from '../controllers/workoutController';
import { deleteCustomFood, updateCustomFood } from '../controllers/customFoodController';
import { connectStrava, stravaCallback } from '../controllers/stravaController';
import { deleteInternalUserData } from '../controllers/internalController';
import { decryptSecret, encryptSecret, signOAuthState, verifyOAuthState } from '../utils/tokenCrypto';

function createMockRes() {
    return {
        statusCode: 200,
        body: null as any,
        redirectedTo: null as string | null,
        headers: {} as Record<string, string>,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        setHeader(key: string, val: string) {
            this.headers[key] = val;
            return this;
        },
        json(payload: any) {
            this.body = payload;
            return this;
        },
        send(payload?: any) {
            this.body = payload ?? null;
            return this;
        },
        redirect(url: string) {
            this.statusCode = 302;
            this.redirectedTo = url;
            return this;
        },
    };
}

describe('Security Hardening — backend-health (OWASP / Vibe-Coding Guardrails)', () => {
    it('Ownership / IDOR: User B cannot edit or delete meals, workouts, or custom foods owned by User A', async () => {
        const origMeal = (prisma as any).mealEntry;
        const origWorkout = (prisma as any).workoutEntry;
        const origCustomFood = (prisma as any).customFood;

        Object.defineProperty(prisma, 'mealEntry', {
            configurable: true,
            value: {
                findUnique: async () => ({ id: 'meal-alice', userId: 'user-alice' }),
                delete: async () => { throw new Error('Should not delete'); },
                update: async () => { throw new Error('Should not update'); },
            },
        });
        Object.defineProperty(prisma, 'workoutEntry', {
            configurable: true,
            value: {
                findUnique: async () => ({ id: 'workout-alice', userId: 'user-alice' }),
                delete: async () => { throw new Error('Should not delete'); },
                update: async () => { throw new Error('Should not update'); },
            },
        });
        Object.defineProperty(prisma, 'customFood', {
            configurable: true,
            value: {
                findUnique: async () => ({ id: 'food-alice', userId: 'user-alice' }),
                delete: async () => { throw new Error('Should not delete'); },
            },
        });

        try {
            const delMealRes = createMockRes();
            await deleteMeal({ user: { id: 'user-bob' }, params: { id: 'meal-alice' } } as any, delMealRes as any);
            assert.equal(delMealRes.statusCode, 403);

            const editMealRes = createMockRes();
            await editMeal(
                {
                    user: { id: 'user-bob' },
                    params: { id: 'meal-alice' },
                    body: { date: '2026-11-19', mealType: 'lunch', name: 'Hack', calories: 500 },
                } as any,
                editMealRes as any
            );
            assert.equal(editMealRes.statusCode, 403);

            const delWorkoutRes = createMockRes();
            await deleteWorkout({ user: { id: 'user-bob' }, params: { id: 'workout-alice' } } as any, delWorkoutRes as any);
            assert.equal(delWorkoutRes.statusCode, 403);

            const updWorkoutRes = createMockRes();
            await updateWorkout(
                {
                    user: { id: 'user-bob' },
                    params: { id: 'workout-alice' },
                    body: { date: '2026-11-19', sport: 'running', durationMin: 30, intensity: 'medium' },
                } as any,
                updWorkoutRes as any
            );
            assert.equal(updWorkoutRes.statusCode, 403);

            const delFoodRes = createMockRes();
            await deleteCustomFood({ user: { id: 'user-bob' }, params: { id: 'food-alice' } } as any, delFoodRes as any);
            assert.equal(delFoodRes.statusCode, 404);

            const updFoodRes = createMockRes();
            await updateCustomFood(
                {
                    user: { id: 'user-bob' },
                    params: { id: 'food-alice' },
                    body: {
                        name: 'Hack',
                        ingredients: [{ ingredientId: '00000000-0000-4000-8000-000000000001', weightGrams: 100 }],
                    },
                } as any,
                updFoodRes as any
            );
            assert.equal(updFoodRes.statusCode, 404);
        } finally {
            Object.defineProperty(prisma, 'mealEntry', { configurable: true, value: origMeal });
            Object.defineProperty(prisma, 'workoutEntry', { configurable: true, value: origWorkout });
            Object.defineProperty(prisma, 'customFood', { configurable: true, value: origCustomFood });
        }
    });

    it('Mass Assignment: rejects unknown fields (userId, stravaAccessToken) in meal/workout/goals schemas with 400', async () => {
        const mealRes = createMockRes();
        await logMeal(
            {
                user: { id: 'user-bob' },
                body: { date: '2026-11-19', mealType: 'lunch', name: 'Pollo', calories: 400, userId: 'user-alice' },
            } as any,
            mealRes as any
        );
        assert.equal(mealRes.statusCode, 400);

        const workoutRes = createMockRes();
        await logWorkout(
            {
                user: { id: 'user-bob' },
                body: { date: '2026-11-19', sport: 'running', durationMin: 30, intensity: 'high', userId: 'user-alice' },
            } as any,
            workoutRes as any
        );
        assert.equal(workoutRes.statusCode, 400);

        const goalsRes = createMockRes();
        await upsertGoals(
            {
                user: { id: 'user-bob' },
                body: { dailyCalorieGoal: 2200, stravaAccessToken: 'injected-token' },
            } as any,
            goalsRes as any
        );
        assert.equal(goalsRes.statusCode, 400);
    });

    it('Secret Projection: getGoals uses explicit select excluding stravaAccessToken and stravaRefreshToken', async () => {
        const origProfile = (prisma as any).userHealthProfile;
        let capturedSelect: any = null;

        Object.defineProperty(prisma, 'userHealthProfile', {
            configurable: true,
            value: {
                findUnique: async (args: any) => {
                    capturedSelect = args?.select;
                    return { id: 'p1', userId: 'u1', dailyCalorieGoal: 2000 };
                },
            },
        });

        try {
            const res = createMockRes();
            await getGoals({ user: { id: 'u1' } } as any, res as any);
            assert.equal(res.statusCode, 200);
            assert.ok(capturedSelect, 'getGoals must pass an explicit select projection');
            assert.equal(capturedSelect.stravaAccessToken, undefined);
            assert.equal(capturedSelect.stravaRefreshToken, undefined);
        } finally {
            Object.defineProperty(prisma, 'userHealthProfile', { configurable: true, value: origProfile });
        }
    });

    it('Strava OAuth CSRF & Token Encryption (F-14 / F-15): signs state, rejects raw userId state, encrypts/decrypts tokens', async () => {
        const origClientId = process.env.STRAVA_CLIENT_ID;
        process.env.STRAVA_CLIENT_ID = '12345';

        try {
            // connectStrava generates signed state (NOT raw userId)
            const authRes = createMockRes();
            connectStrava({ user: { id: 'user-alice' } } as any, authRes as any);
            assert.equal(authRes.statusCode, 200);
            const parsedUrl = new URL(authRes.body.url);
            const stateParam = parsedUrl.searchParams.get('state') || '';
            assert.notEqual(stateParam, 'user-alice', 'state must NOT be raw userId');
            assert.equal(verifyOAuthState(stateParam), 'user-alice');

            // stravaCallback rejects raw/tampered userId state
            const cbRes = createMockRes();
            await stravaCallback({ query: { code: 'abc', state: 'user-alice' } } as any, cbRes as any);
            assert.equal(cbRes.statusCode, 400, 'Raw userId state must be rejected with 400');

            // Token AES-256-GCM encryption round-trip + legacy plaintext fallback
            const rawToken = 'strava-live-secret-token-xyz';
            const encrypted = encryptSecret(rawToken);
            assert.ok(encrypted.startsWith('enc:v1:'));
            assert.notEqual(encrypted, rawToken);
            assert.equal(decryptSecret(encrypted), rawToken);
            assert.equal(decryptSecret('legacy-plaintext-token'), 'legacy-plaintext-token');
            assert.equal(signOAuthState('u1') !== 'u1', true);
        } finally {
            if (origClientId === undefined) delete process.env.STRAVA_CLIENT_ID;
            else process.env.STRAVA_CLIENT_ID = origClientId;
        }
    });

    it('Internal Auth & Rate Limit: constant-time key check rejects wrong key (403); rate limiter returns 429', () => {
        const badRes = createMockRes();
        let nextCalled = false;
        internalAuth({ headers: { 'x-internal-api-key': 'wrong-key' } } as any, badRes as any, () => {
            nextCalled = true;
        });
        assert.equal(badRes.statusCode, 403);
        assert.equal(nextCalled, false);

        const goodRes = createMockRes();
        internalAuth({ headers: { 'x-internal-api-key': config.internalApiKey } } as any, goodRes as any, () => {
            nextCalled = true;
        });
        assert.equal(nextCalled, true);

        const limiter = createRateLimiter({ windowMs: 60_000, max: 2, message: 'Too many' });
        const statuses: number[] = [];
        for (let i = 0; i < 3; i++) {
            const r = createMockRes();
            let ok = false;
            limiter({ headers: {}, ip: '10.0.0.1' } as any, r as any, () => {
                ok = true;
            });
            statuses.push(ok ? 200 : r.statusCode);
        }
        assert.deepEqual(statuses, [200, 200, 429]);
    });

    it('Multi-DB Erasure: deleteInternalUserData purges all 5 health tables in transaction', async () => {
        const origTx = (prisma as any).$transaction;
        const deletedTables: string[] = [];

        Object.defineProperty(prisma, '$transaction', {
            configurable: true,
            value: async (fn: any) =>
                fn({
                    customFoodIngredient: { deleteMany: async () => { deletedTables.push('customFoodIngredient'); } },
                    customFood: { deleteMany: async () => { deletedTables.push('customFood'); } },
                    mealEntry: { deleteMany: async () => { deletedTables.push('mealEntry'); } },
                    workoutEntry: { deleteMany: async () => { deletedTables.push('workoutEntry'); } },
                    userHealthProfile: { deleteMany: async () => { deletedTables.push('userHealthProfile'); } },
                }),
        });

        try {
            const res = createMockRes();
            await deleteInternalUserData({ params: { userId: 'user-alice' } } as any, res as any);
            assert.equal(res.statusCode, 200);
            assert.deepEqual(deletedTables, [
                'customFoodIngredient',
                'customFood',
                'mealEntry',
                'workoutEntry',
                'userHealthProfile',
            ]);
        } finally {
            Object.defineProperty(prisma, '$transaction', { configurable: true, value: origTx });
        }
    });
});
