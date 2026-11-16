import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import prisma from '../lib/prisma';
import { getMonthlyStats, getWeeklyStats } from '../controllers/statsController';
import { syncStravaWorkouts } from '../controllers/stravaController';
import { asyncHandler } from '../utils/asyncHandler';

function createMockRes() {
    return {
        statusCode: 200,
        body: null as any,
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
    };
}

describe('Fase 3 — backend-health SQL, N+1, Singleton Pool & Async Error Handling', () => {
    it('getMonthlyStats & getWeeklyStats execute 3 concurrent queries instead of 15–63 N+1 queries (F-09)', async () => {
        const origProfile = (prisma as any).userHealthProfile;
        const origMeal = (prisma as any).mealEntry;
        const origWorkout = (prisma as any).workoutEntry;

        let profileQueries = 0;
        let mealQueries = 0;
        let workoutQueries = 0;

        Object.defineProperty(prisma, 'userHealthProfile', {
            configurable: true,
            value: {
                findUnique: async () => {
                    profileQueries += 1;
                    return {
                        id: 'p1',
                        userId: 'u1',
                        dailyCalorieGoal: 2200,
                        proteinGoalG: 160,
                        carbGoalG: 220,
                        fatGoalG: 70,
                    };
                },
            },
        });

        Object.defineProperty(prisma, 'mealEntry', {
            configurable: true,
            value: {
                findMany: async () => {
                    mealQueries += 1;
                    return [
                        {
                            id: 'm1',
                            userId: 'u1',
                            date: '2026-10-01',
                            mealType: 'lunch',
                            name: 'Pollo',
                            calories: 600,
                            proteinG: 50,
                            carbG: 40,
                            fatG: 15,
                        },
                        {
                            id: 'm2',
                            userId: 'u1',
                            date: '2026-10-15',
                            mealType: 'dinner',
                            name: 'Salmón',
                            calories: 500,
                            proteinG: 40,
                            carbG: 20,
                            fatG: 25,
                        },
                    ];
                },
            },
        });

        Object.defineProperty(prisma, 'workoutEntry', {
            configurable: true,
            value: {
                findMany: async () => {
                    workoutQueries += 1;
                    return [
                        {
                            id: 'w1',
                            userId: 'u1',
                            date: '2026-10-01',
                            sport: 'running',
                            durationMin: 30,
                            caloriesBurned: 300,
                        },
                    ];
                },
            },
        });

        try {
            const req: any = { user: { id: 'u1' }, query: { month: '2026-10' } };
            const res = createMockRes();
            await getMonthlyStats(req, res as any);

            assert.equal(profileQueries, 1);
            assert.equal(mealQueries, 1);
            assert.equal(workoutQueries, 1);
            assert.equal(res.body.days.length, 31);
            assert.equal(res.body.totals.consumed, 1100);
            assert.equal(res.body.totals.burned, 300);

            const reqWeek: any = { user: { id: 'u1' }, query: { startDate: '2026-10-01' } };
            const resWeek = createMockRes();
            await getWeeklyStats(reqWeek, resWeek as any);
            assert.equal(resWeek.body.days.length, 7);
        } finally {
            Object.defineProperty(prisma, 'userHealthProfile', { configurable: true, value: origProfile });
            Object.defineProperty(prisma, 'mealEntry', { configurable: true, value: origMeal });
            Object.defineProperty(prisma, 'workoutEntry', { configurable: true, value: origWorkout });
        }
    });

    it('syncStravaWorkouts batches 20 activities into 1 findMany + 1 createMany instead of 61 sequential queries (F-16)', async () => {
        const origProfile = (prisma as any).userHealthProfile;
        const origWorkout = (prisma as any).workoutEntry;
        const origAxiosGet = axios.get;

        let profileQueries = 0;
        let findManyCalls = 0;
        let createManyCalls = 0;

        Object.defineProperty(prisma, 'userHealthProfile', {
            configurable: true,
            value: {
                findUnique: async () => {
                    profileQueries += 1;
                    return {
                        id: 'p1',
                        userId: 'u1',
                        weightKg: 75,
                        stravaAccessToken: 'valid-token',
                        stravaTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
                    };
                },
            },
        });

        (axios as any).get = async () => ({
            data: Array.from({ length: 20 }, (_, idx) => ({
                id: 1000 + idx,
                type: idx % 2 === 0 ? 'Run' : 'WeightTraining',
                moving_time: 2700,
                distance: 5000,
                start_date_local: '2026-11-16T10:00:00Z',
                name: `Workout #${idx + 1}`,
            })),
        });

        Object.defineProperty(prisma, 'workoutEntry', {
            configurable: true,
            value: {
                findMany: async () => {
                    findManyCalls += 1;
                    return [{ externalId: '1000' }, { externalId: '1001' }];
                },
                createMany: async () => {
                    createManyCalls += 1;
                    return { count: 18 };
                },
            },
        });

        try {
            const req: any = { user: { id: 'u1' } };
            const res = createMockRes();
            await syncStravaWorkouts(req, res as any);

            assert.equal(profileQueries, 1, 'Profile must only be queried once');
            assert.equal(findManyCalls, 1, 'Existing workouts must be checked in 1 bulk findMany');
            assert.equal(createManyCalls, 1, 'New workouts must be inserted in 1 bulk createMany');
            assert.equal(res.body.count, 18);
        } finally {
            Object.defineProperty(prisma, 'userHealthProfile', { configurable: true, value: origProfile });
            Object.defineProperty(prisma, 'workoutEntry', { configurable: true, value: origWorkout });
            axios.get = origAxiosGet;
        }
    });

    it('asyncHandler forwards rejected promises to Express next(err) instead of hanging (F-08)', async () => {
        const dbError = new Error('Connection terminated unexpectedly');
        const wrapped = asyncHandler(async () => {
            throw dbError;
        });

        let capturedErr: any = null;
        await wrapped({} as any, {} as any, (err?: any) => {
            capturedErr = err;
        });
        assert.equal(capturedErr, dbError);
    });
});
