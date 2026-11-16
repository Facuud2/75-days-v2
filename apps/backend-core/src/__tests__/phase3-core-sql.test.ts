import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../utils/prisma';
import { updateGoalStatus } from '../controllers/logController';
import { buildUserProfilePayload } from '../controllers/userController';

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

describe('Fase 3 — backend-core SQL & Egress Optimizations', () => {
    it('updateGoalStatus executes 1 joined read + 1 parallel write batch inside transaction instead of 8 sequential queries', async () => {
        const origDailyGoal = (prisma as any).dailyGoal;
        const origTransaction = (prisma as any).$transaction;

        let txReadCount = 0;
        let txGoalUpdates = 0;
        let txLogUpdates = 0;
        let txChallengeUpdates = 0;

        Object.defineProperty(prisma, 'dailyGoal', {
            configurable: true,
            value: {
                findFirst: async () => ({
                    id: 'g1',
                    dailyLogId: 'log-1',
                    dailyLog: { id: 'log-1', status: 'pending' },
                }),
            },
        });

        Object.defineProperty(prisma, '$transaction', {
            configurable: true,
            value: async (fn: any) => {
                const tx = {
                    $queryRaw: async () => [{ locked: 1 }],
                    dailyLog: {
                        findUnique: async () => {
                            txReadCount += 1;
                            return {
                                id: 'log-1',
                                date: '2026-11-16',
                                status: 'pending',
                                challengeId: 'ch-1',
                                goals: [
                                    { id: 'g1', title: 'Agua', completed: false },
                                    { id: 'g2', title: 'Entrenar', completed: true },
                                ],
                                challenge: { id: 'ch-1', points: 20, streak: 2 },
                            };
                        },
                        update: async () => {
                            txLogUpdates += 1;
                            return {};
                        },
                    },
                    dailyGoal: {
                        update: async () => {
                            txGoalUpdates += 1;
                            return {};
                        },
                    },
                    challenge: {
                        update: async () => {
                            txChallengeUpdates += 1;
                            return {};
                        },
                    },
                };
                return fn(tx);
            },
        });

        try {
            const req: any = {
                user: { id: 'u1' },
                params: { date: '2026-11-16', goalId: 'g1' },
                body: { completed: true },
            };
            const res = createMockRes();

            await updateGoalStatus(req, res as any);

            assert.equal(txReadCount, 1, 'Should only perform 1 joined read inside transaction');
            assert.equal(txGoalUpdates, 1);
            assert.equal(txLogUpdates, 1);
            assert.equal(txChallengeUpdates, 1);
            assert.equal(res.body.status, 'success');
            assert.equal(res.body.challengeStreak, 3);
            assert.equal(res.body.challengePoints, 30);
        } finally {
            Object.defineProperty(prisma, 'dailyGoal', { configurable: true, value: origDailyGoal });
            Object.defineProperty(prisma, '$transaction', { configurable: true, value: origTransaction });
        }
    });

    it('buildUserProfilePayload excludes photoUrl egress and performs 0 achievement writes when unchanged (F-05)', async () => {
        const origUser = (prisma as any).user;
        const origAchievement = (prisma as any).achievement;

        let capturedQueryArgs: any = null;
        let achUpdates = 0;
        let achCreates = 0;

        Object.defineProperty(prisma, 'user', {
            configurable: true,
            value: {
                findUnique: async (args: any) => {
                    capturedQueryArgs = args;
                    return {
                        id: 'u1',
                        name: 'Facu',
                        email: 'facu@example.com',
                        weight: 80,
                        targetWeight: 75,
                        height: 178,
                        registeredAt: new Date('2026-01-01'),
                        challenges: [
                            {
                                id: 'ch-1',
                                streak: 3,
                                challengesCompleted: 0,
                                dailyLogs: [{ date: '2026-11-16', status: 'success', weight: 79 }],
                            },
                        ],
                        sideQuests: [],
                        achievements: [
                            { id: 'a1', title: 'Primer Paso', progress: 1, total: 1, unlocked: true, unlockedAt: new Date() },
                            { id: 'a2', title: 'Constancia', progress: 3, total: 7, unlocked: false, unlockedAt: null },
                            { id: 'a3', title: 'Disciplina', progress: 0, total: 1, unlocked: false, unlockedAt: null },
                            { id: 'a4', title: 'Fuerza de Voluntad', progress: 1, total: 10, unlocked: false, unlockedAt: null },
                            { id: 'a5', title: 'Aventurero', progress: 0, total: 1, unlocked: false, unlockedAt: null },
                            { id: 'a6', title: 'Transformación', progress: 1, total: 5, unlocked: false, unlockedAt: null },
                        ],
                    };
                },
            },
        });

        Object.defineProperty(prisma, 'achievement', {
            configurable: true,
            value: {
                update: async () => {
                    achUpdates += 1;
                    return {};
                },
                create: async () => {
                    achCreates += 1;
                    return {};
                },
            },
        });

        try {
            const payload = await buildUserProfilePayload('u1');
            assert.deepEqual(
                capturedQueryArgs?.include?.challenges?.include?.dailyLogs,
                {
                    select: {
                        date: true,
                        status: true,
                        weight: true,
                    },
                }
            );
            assert.equal(achUpdates, 0);
            assert.equal(achCreates, 0);
            assert.equal(payload?.stats.totalDaysCompleted, 1);
        } finally {
            Object.defineProperty(prisma, 'user', { configurable: true, value: origUser });
            Object.defineProperty(prisma, 'achievement', { configurable: true, value: origAchievement });
        }
    });
});
