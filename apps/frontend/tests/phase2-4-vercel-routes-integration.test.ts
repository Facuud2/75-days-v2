import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GET as healthGet } from '../app/api/health/route';
import { POST as registerPost } from '../app/api/auth/register/route';
import { POST as loginPost } from '../app/api/auth/login/route';
import { GET as meGet } from '../app/api/auth/me/route';
import { PATCH as completeOnboardingPatch } from '../app/api/auth/complete-onboarding/route';
import { GET as coreSyncGet } from '../app/api/sync/route';
import { PUT as updateGoalPut } from '../app/api/logs/[date]/goal/[goalId]/route';
import { PUT as updateMetricsPut } from '../app/api/logs/[date]/metrics/route';
import { POST as addQuestPost } from '../app/api/quests/route';
import { PATCH as toggleQuestTaskPatch } from '../app/api/quests/[id]/tasks/[taskId]/route';
import { POST as logMealPost } from '../app/api/nutrition/meals/route';
import {
  DELETE as deleteMealRoute,
  GET as getMealsForDayRoute,
  PUT as editMealRoute,
} from '../app/api/nutrition/meals/[param]/route';
import { POST as logWorkoutPost } from '../app/api/workouts/route';
import {
  DELETE as deleteWorkoutRoute,
  GET as getWorkoutsForDayRoute,
  PUT as updateWorkoutRoute,
} from '../app/api/workouts/[param]/route';
import { GET as healthSyncGet } from '../app/api/sync/[date]/route';
import { GET as ingredientsGet } from '../app/api/nutrition/custom-foods/ingredients/route';
import { POST as createCustomFoodPost } from '../app/api/nutrition/custom-foods/route';
import { DELETE as deleteCustomFoodRoute } from '../app/api/nutrition/custom-foods/[id]/route';
import { DELETE as deleteAccountRoute } from '../app/api/users/account/route';
import { getHealthPrisma } from '../lib/server/db';

function hydrateEnvFromLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

describe('Phase 2–4 — End-to-End Route Handlers + Neon Serverless + Upstash Redis', () => {
  let token = '';
  let userId = '';
  let todayDate = '';
  let firstGoalId = '';
  const testEmail = `vercel-mig-${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  beforeAll(() => {
    hydrateEnvFromLocal();
  });

  it('GET /api/health?deep=1 warms both Neon databases', async () => {
    const req = new Request('http://localhost:3000/api/health?deep=1');
    const res = await healthGet(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.dbWarmed).toBe(true);
  }, 15_000);

  it('POST /api/auth/register & POST /api/auth/login work with Upstash Redis rate limiting and Neon transactions', async () => {
    const regReq = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        name: 'Vercel Serverless Tester',
        email: testEmail,
        password: testPassword,
        difficulty: 'Medium',
      }),
    });

    const regRes = await registerPost(regReq, {});
    expect(regRes.status).toBe(201);
    const regBody = await regRes.json();
    expect(regBody.token).toBeTruthy();
    expect(regBody.user.email).toBe(testEmail);
    expect(regBody.challenge.dailyLogs).toHaveLength(1);

    token = regBody.token;
    userId = regBody.user.id;
    todayDate = regBody.challenge.dailyLogs[0].date;
    firstGoalId = regBody.challenge.dailyLogs[0].goals[0].id;

    const loginReq = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const loginRes = await loginPost(loginReq, {});
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.user.id).toBe(userId);
  }, 15_000);

  it('GET /api/auth/me, PATCH /api/auth/complete-onboarding & GET /api/sync', async () => {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const meRes = await meGet(
      new Request('http://localhost:3000/api/auth/me', { headers: authHeaders }),
      {}
    );
    expect(meRes.status).toBe(200);

    const onbRes = await completeOnboardingPatch(
      new Request('http://localhost:3000/api/auth/complete-onboarding', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ age: 29, weight: 78, targetWeight: 72, height: 178 }),
      }),
      {}
    );
    expect(onbRes.status).toBe(200);
    const onbBody = await onbRes.json();
    expect(onbBody.user.onboardingCompleted).toBe(true);

    const syncRes = await coreSyncGet(
      new Request('http://localhost:3000/api/sync?includeProfile=true', {
        headers: authHeaders,
      }),
      {}
    );
    expect(syncRes.status).toBe(200);
    const syncBody = await syncRes.json();
    expect(syncBody.syncVersion).toBe(1);
    expect(syncBody.challenge.id).toBeTruthy();
    expect(syncBody.availableQuests.length).toBeGreaterThanOrEqual(3);
    expect(syncBody.profile.user.id).toBe(userId);
  }, 15_000);

  it('PUT /api/logs/[date]/goal/[goalId], PUT /api/logs/[date]/metrics & SideQuests', async () => {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const goalRes = await updateGoalPut(
      new Request(
        `http://localhost:3000/api/logs/${todayDate}/goal/${firstGoalId}`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ completed: true }),
        }
      ),
      { params: Promise.resolve({ date: todayDate, goalId: firstGoalId }) }
    );
    expect(goalRes.status).toBe(200);
    const goalBody = await goalRes.json();
    expect(
      goalBody.goals.find((g: any) => g.id === firstGoalId)?.completed
    ).toBe(true);

    const metricsRes = await updateMetricsPut(
      new Request(`http://localhost:3000/api/logs/${todayDate}/metrics`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ weight: 77.4, notes: 'Día excelente' }),
      }),
      { params: Promise.resolve({ date: todayDate }) }
    );
    expect(metricsRes.status).toBe(200);
    const metricsBody = await metricsRes.json();
    expect(metricsBody.weight).toBe(77.4);

    const questRes = await addQuestPost(
      new Request('http://localhost:3000/api/quests', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Misión Serverless',
          difficulty: 'Easy',
          durationDays: 7,
          tasks: [{ title: 'Meditar 10m', frequency: 'daily' }],
        }),
      }),
      {}
    );
    expect(questRes.status).toBe(201);
    const questBody = await questRes.json();
    const questId = questBody.id;
    const taskId = questBody.currentRun.tasks[0].id;

    const toggleRes = await toggleQuestTaskPatch(
      new Request(
        `http://localhost:3000/api/quests/${questId}/tasks/${taskId}`,
        { method: 'PATCH', headers: authHeaders }
      ),
      { params: Promise.resolve({ id: questId, taskId }) }
    );
    expect(toggleRes.status).toBe(200);
    const toggleBody = await toggleRes.json();
    expect(toggleBody.progress).toBe(1);
    expect(toggleBody.todayCompleted).toBe(true);
    expect(toggleBody.completed).toBe(false);
  }, 15_000);

  it('Health routes: Meals, Workouts, CustomFoods & /api/sync/[date]', async () => {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 1. Log a meal
    const mealRes = await logMealPost(
      new Request('http://localhost:3000/api/nutrition/meals', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          date: todayDate,
          mealType: 'lunch',
          name: 'Pollo con arroz',
          calories: 620,
          proteinG: 48,
          carbG: 65,
          fatG: 14,
        }),
      }),
      {}
    );
    expect(mealRes.status).toBe(201);
    const meal = await mealRes.json();

    // 2. Get meals for day via [param]
    const dayMealsRes = await getMealsForDayRoute(
      new Request(`http://localhost:3000/api/nutrition/meals/${todayDate}`, {
        headers: authHeaders,
      }),
      { params: Promise.resolve({ param: todayDate }) }
    );
    expect(dayMealsRes.status).toBe(200);
    const dayMeals = await dayMealsRes.json();
    expect(dayMeals.totals.calories).toBe(620);

    // 3. Edit meal via [param]
    const editMealRes = await editMealRoute(
      new Request(`http://localhost:3000/api/nutrition/meals/${meal.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          date: todayDate,
          mealType: 'lunch',
          name: 'Pollo con arroz integral',
          calories: 650,
          proteinG: 50,
          carbG: 68,
          fatG: 14,
        }),
      }),
      { params: Promise.resolve({ param: meal.id }) }
    );
    expect(editMealRes.status).toBe(200);

    // 4. Log a workout
    const workoutRes = await logWorkoutPost(
      new Request('http://localhost:3000/api/workouts', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          date: todayDate,
          sport: 'running',
          durationMin: 45,
          intensity: 'medium',
          distanceKm: 7.5,
        }),
      }),
      {}
    );
    expect(workoutRes.status).toBe(201);
    const workout = await workoutRes.json();
    expect(workout.caloriesBurned).toBeGreaterThan(0);

    // 5. Get workouts for day & update workout via [param]
    const dayWorkoutsRes = await getWorkoutsForDayRoute(
      new Request(`http://localhost:3000/api/workouts/${todayDate}`, {
        headers: authHeaders,
      }),
      { params: Promise.resolve({ param: todayDate }) }
    );
    expect(dayWorkoutsRes.status).toBe(200);

    const updWorkoutRes = await updateWorkoutRoute(
      new Request(`http://localhost:3000/api/workouts/${workout.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          date: todayDate,
          sport: 'running',
          durationMin: 50,
          intensity: 'high',
        }),
      }),
      { params: Promise.resolve({ param: workout.id }) }
    );
    expect(updWorkoutRes.status).toBe(200);

    // 6. Custom food creation & deletion (204)
    const ingRes = await ingredientsGet(
      new Request(
        'http://localhost:3000/api/nutrition/custom-foods/ingredients',
        { headers: authHeaders }
      ),
      {}
    );
    expect(ingRes.status).toBe(200);
    const ingredients = await ingRes.json();
    expect(ingredients.length).toBeGreaterThan(0);

    const cfRes = await createCustomFoodPost(
      new Request('http://localhost:3000/api/nutrition/custom-foods', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Bowl Proteico Test',
          ingredients: [{ ingredientId: ingredients[0].id, weightGrams: 150 }],
        }),
      }),
      {}
    );
    expect(cfRes.status).toBe(201);
    const customFood = await cfRes.json();

    // 7. Health sync (/api/sync/[date])
    const hSyncRes = await healthSyncGet(
      new Request(`http://localhost:3000/api/sync/${todayDate}`, {
        headers: authHeaders,
      }),
      { params: Promise.resolve({ date: todayDate }) }
    );
    expect(hSyncRes.status).toBe(200);
    const hSync = await hSyncRes.json();
    expect(hSync.dailyStats.consumed).toBe(650);
    expect(hSync.dailyStats.totalWorkoutMin).toBe(50);

    // Cleanup health records & account
    const delCfRes = await deleteCustomFoodRoute(
      new Request(
        `http://localhost:3000/api/nutrition/custom-foods/${customFood.id}`,
        { method: 'DELETE', headers: authHeaders }
      ),
      { params: Promise.resolve({ id: customFood.id }) }
    );
    expect(delCfRes.status).toBe(204);

    const delMealRes = await deleteMealRoute(
      new Request(`http://localhost:3000/api/nutrition/meals/${meal.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      }),
      { params: Promise.resolve({ param: meal.id }) }
    );
    expect(delMealRes.status).toBe(200);

    const delWorkoutRes = await deleteWorkoutRoute(
      new Request(`http://localhost:3000/api/workouts/${workout.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      }),
      { params: Promise.resolve({ param: workout.id }) }
    );
    expect(delWorkoutRes.status).toBe(200);

    await getHealthPrisma().userHealthProfile.deleteMany({ where: { userId } });

    const delAccRes = await deleteAccountRoute(
      new Request('http://localhost:3000/api/users/account', {
        method: 'DELETE',
        headers: authHeaders,
      }),
      {}
    );
    expect(delAccRes.status).toBe(200);
  }, 20_000);
});
