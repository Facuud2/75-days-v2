import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../utils/prisma';
import { healthClient } from '../utils/healthClient';
import { updateGoalStatus, updateMetrics } from '../controllers/logController';
import { toggleQuestTask } from '../controllers/questController';
import { deleteAccount, exportUserData, updateProfile } from '../controllers/userController';
import { securityHeaders } from '../middlewares/securityHeaders';

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

describe('Security Hardening — backend-core (OWASP / Vibe-Coding Guardrails)', () => {
    it('Ownership / IDOR: User B cannot toggle a DailyGoal or SideQuest owned by User A', async () => {
        const origDailyGoal = (prisma as any).dailyGoal;
        const origSideQuest = (prisma as any).sideQuest;

        Object.defineProperty(prisma, 'dailyGoal', {
            configurable: true,
            value: {
                findFirst: async (args: any) => {
                    // Only exists for alice, never for bob
                    if (args?.where?.dailyLog?.challenge?.userId === 'user-alice') {
                        return { id: 'goal-alice-1', dailyLogId: 'log-1', dailyLog: { id: 'log-1', status: 'pending' } };
                    }
                    return null;
                },
            },
        });

        Object.defineProperty(prisma, 'sideQuest', {
            configurable: true,
            value: {
                findFirst: async (args: any) => {
                    if (args?.where?.userId === 'user-alice') {
                        return { id: 'quest-alice-1', userId: 'user-alice', runs: [{ id: 'run-1', completed: false, tasks: [] }] };
                    }
                    return null;
                },
            },
        });

        try {
            const goalRes = createMockRes();
            await updateGoalStatus(
                {
                    user: { id: 'user-bob' },
                    params: { date: '2026-11-19', goalId: 'goal-alice-1' },
                    body: { completed: true },
                } as any,
                goalRes as any
            );
            assert.equal(goalRes.statusCode, 404, 'User B must receive 404 when targeting User A goal');

            const questRes = createMockRes();
            await toggleQuestTask(
                {
                    user: { id: 'user-bob' },
                    params: { id: 'quest-alice-1', taskId: 'task-1' },
                    body: {},
                } as any,
                questRes as any
            );
            assert.equal(questRes.statusCode, 404, 'User B must receive 404 when targeting User A side quest');
        } finally {
            Object.defineProperty(prisma, 'dailyGoal', { configurable: true, value: origDailyGoal });
            Object.defineProperty(prisma, 'sideQuest', { configurable: true, value: origSideQuest });
        }
    });

    it('Mass Assignment: rejects unknown or privileged fields in updateProfile with 400', async () => {
        const res = createMockRes();
        await updateProfile(
            {
                user: { id: 'user-alice' },
                body: {
                    name: 'Alice',
                    role: 'admin',
                    googleId: 'hijacked-google-id',
                    onboardingCompleted: true,
                },
            } as any,
            res as any
        );
        assert.equal(res.statusCode, 400, 'Strict Zod schema must reject extra fields');
    });

    it('Input Validation (F-24): rejects malformed date strings in updateGoalStatus & updateMetrics', async () => {
        const resGoal = createMockRes();
        await updateGoalStatus(
            {
                user: { id: 'user-alice' },
                params: { date: '2026-11-19; DROP TABLE users;', goalId: 'g1' },
                body: { completed: true },
            } as any,
            resGoal as any
        );
        assert.equal(resGoal.statusCode, 400);

        const resMetrics = createMockRes();
        await updateMetrics(
            {
                user: { id: 'user-alice' },
                params: { date: 'not-a-date' },
                body: { weight: 75 },
            } as any,
            resMetrics as any
        );
        assert.equal(resMetrics.statusCode, 400);
    });

    it('Multi-DB Account Erasure: purges backend-health BEFORE deleting core user, and fails closed (502) if health purge fails', async () => {
        const origUser = (prisma as any).user;
        const origTx = (prisma as any).$transaction;
        const origDeleteHealth = healthClient.deleteUserHealthData;

        const callOrder: string[] = [];

        Object.defineProperty(prisma, 'user', {
            configurable: true,
            value: {
                findUnique: async () => ({ id: 'user-alice', email: 'alice@test.local' }),
            },
        });
        Object.defineProperty(prisma, '$transaction', {
            configurable: true,
            value: async (fn: any) => {
                callOrder.push('core-tx');
                const noop = async () => ({ count: 1 });
                return fn({
                    dailyGoal: { deleteMany: noop },
                    dailyLog: { deleteMany: noop },
                    goalTemplate: { deleteMany: noop },
                    challenge: { deleteMany: noop },
                    sideQuest: { deleteMany: noop },
                    achievement: { deleteMany: noop },
                    user: { delete: noop },
                });
            },
        });

        try {
            // 1. Failure mode: health purge fails -> fail closed 502, core DB NOT touched
            healthClient.deleteUserHealthData = async () => {
                throw new Error('Health service unavailable');
            };
            const failRes = createMockRes();
            await deleteAccount({ user: { id: 'user-alice' } } as any, failRes as any);
            assert.equal(failRes.statusCode, 502);
            assert.equal(callOrder.length, 0, 'Core user must NOT be deleted if health purge failed');

            // 2. Success mode: health purge runs first, then core tx
            healthClient.deleteUserHealthData = async (uid: string) => {
                callOrder.push(`health-delete:${uid}`);
            };
            const okRes = createMockRes();
            await deleteAccount({ user: { id: 'user-alice' } } as any, okRes as any);
            assert.equal(okRes.statusCode, 200);
            assert.deepEqual(callOrder, ['health-delete:user-alice', 'core-tx']);
        } finally {
            Object.defineProperty(prisma, 'user', { configurable: true, value: origUser });
            Object.defineProperty(prisma, '$transaction', { configurable: true, value: origTx });
            healthClient.deleteUserHealthData = origDeleteHealth;
        }
    });

    it('Data Portability: exportUserData omits passwordHash and sets attachment header', async () => {
        const origUser = (prisma as any).user;
        const origExportHealth = healthClient.exportUserHealthData;
        let capturedSelect: any = null;

        Object.defineProperty(prisma, 'user', {
            configurable: true,
            value: {
                findUnique: async (args: any) => {
                    capturedSelect = args?.select;
                    return {
                        id: 'user-alice',
                        name: 'Alice',
                        email: 'alice@test.local',
                        profileQuote: 'Foco',
                        age: 28,
                        weight: 65,
                        targetWeight: 62,
                        height: 168,
                        registeredAt: new Date('2026-01-01'),
                        onboardingCompleted: true,
                        challenges: [],
                        sideQuests: [],
                        achievements: [],
                    };
                },
            },
        });
        healthClient.exportUserHealthData = async () => ({
            profile: { dailyCalorieGoal: 2000 },
            meals: [],
            workouts: [],
            customFoods: [],
        });

        try {
            const res = createMockRes();
            await exportUserData({ user: { id: 'user-alice' } } as any, res as any);
            assert.equal(res.statusCode, 200);
            assert.equal(capturedSelect?.passwordHash, undefined, 'passwordHash must never be selected');
            assert.equal(res.body?.account?.passwordHash, undefined);
            assert.match(res.headers['Content-Disposition'] || '', /75days-mis-datos\.json/);
        } finally {
            Object.defineProperty(prisma, 'user', { configurable: true, value: origUser });
            healthClient.exportUserHealthData = origExportHealth;
        }
    });

    it('Security Headers: sets baseline OWASP headers', () => {
        const res = createMockRes();
        let calledNext = false;
        securityHeaders({} as any, res as any, () => {
            calledNext = true;
        });
        assert.equal(calledNext, true);
        assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
        assert.equal(res.headers['X-Frame-Options'], 'DENY');
        assert.equal(res.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    });
});
