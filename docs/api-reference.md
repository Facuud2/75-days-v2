# API Reference

> Ancla: `apps/backend-core/src/routes`, `apps/backend-health/src/routes`.
> Confianza: **Leído**. Los códigos de estado marcados **Medido** se observaron contra los servicios corriendo.

Convenciones:

- Todos los cuerpos y respuestas son JSON.
- `Auth` = requiere `Authorization: Bearer <jwt>`. `—` = público.
- `Key` = requiere `x-internal-api-key`.
- Un error de validación Zod devuelve 400 con `{ error, details }` en `backend-core` y `{ error: <flatten> }` en `backend-health`. **No hay formato de error unificado entre servicios.**

---

## backend-core — `/api`

### Auth

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/api/auth/register` | — | `name`, `email`, `password`, `difficulty?` (`Soft`\|`Medium`\|`Hard`\|`Custom`), `customGoalsTemplate?[]` | 201 `{ token, user, challenge }` |
| POST | `/api/auth/login` | — | `email`, `password` | 200 `{ token, user }` · 401 credenciales |
| GET | `/api/auth/me` | Auth | — | 200 `{ user }` |
| PATCH | `/api/auth/complete-onboarding` | Auth | `age?`, `weight?`, `targetWeight?`, `height?` | 200 `{ user }` |
| GET | `/api/auth/onboarding-status` | Auth | — | 200 `{ onboardingCompleted }` |

`register` crea usuario + reto + plantillas + primer registro diario en una transacción. `login` y `register` son los únicos endpoints públicos de este servicio.

### Challenges

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| GET | `/api/challenges/current` | Auth | — | 200 reto con `customGoalsTemplate` y `dailyLogs[]` · 404 sin reto activo |
| POST | `/api/challenges/start` | Auth | `difficulty`, `customGoalsTemplate?[]` | 201 reto · 400 `Custom` sin metas |
| POST | `/api/challenges/abandon` | Auth | — | 200 `{ message }` — borra si <24 h, archiva si ≥24 h |

### Logs diarios

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| GET | `/api/logs` | Auth | — | 200 `DailyLog[]` con metas, orden ascendente por fecha |
| PUT | `/api/logs/:date/goal/:goalId` | Auth | `{ completed: boolean }` | 200 log + `challengeStreak` + `challengePoints` |
| PUT | `/api/logs/:date/metrics` | Auth | `weight?`, `photoUrl?`, `notes?` | 200 log con metas |
| POST | `/api/logs/check-reset` | Auth | `{ timezoneOffset?: number }` | 200 `{ message, streak, currentDay, logs[] }` |

`:date` en formato `YYYY-MM-DD`. **No se valida el formato** en los endpoints de logs: una fecha malformada simplemente no encuentra el registro y devuelve 404.

### Misiones secundarias

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| GET | `/api/quests` | Auth | — | 200 `SideQuest[]` del usuario |
| GET | `/api/quests/available` | Auth | — | 200 `SideQuestTemplate[]` · **500 hoy** (tabla ausente) |
| POST | `/api/quests` | Auth | Plantilla: `title`, `difficulty` (`Easy`\|`Medium`\|`Hard`), `durationDays`. Personalizada: además `description`, `icon` y `tasks[]` (`title`, `description`, `frequency`, `targetValue`, `targetUnit`, `icon`) | 201 `SideQuest` |
| PUT | `/api/quests/:id/progress` | Auth | — | 200 `SideQuest` · 400 si ya está completa |

### Usuarios

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| GET | `/api/users/profile` | Auth | — | 200 `{ user, stats, achievements }` · **500 hoy** (tabla ausente) |
| PUT | `/api/users/profile` | Auth | `name?`, `email?`, `age?`, `weight?`, `targetWeight?`, `height?` | 200 `{ user }` · 400 email en uso |
| PUT | `/api/users/password` | Auth | `currentPassword`, `newPassword` (≥6) | 200 `{ message }` · 400 actual incorrecta |

`GET /users/profile` **escribe**: recalcula y persiste logros en cada llamada.

### Salud del servicio

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` |

---

## backend-health — `/api`

### Nutrición

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/api/nutrition/meals` | Auth | `date`, `mealType` (`breakfast`\|`lunch`\|`dinner`\|`snack`), `name`, `calories`, `proteinG?`, `carbG?`, `fatG?` | 201 `MealEntry` |
| GET | `/api/nutrition/meals/:date` | Auth | — | 200 `{ date, totals, grouped, all }` |
| PUT | `/api/nutrition/meals/:id` | Auth | igual que POST | 200 `MealEntry` · 403 si no es dueño |
| DELETE | `/api/nutrition/meals/:id` | Auth | — | 200 `{ message }` · 403 si no es dueño |
| GET | `/api/nutrition/goals` | Auth | — | 200 perfil · 200 defaults con `message` si no existe |
| PUT | `/api/nutrition/goals` | Auth | `dailyCalorieGoal?`, `proteinGoalG?`, `carbGoalG?`, `fatGoalG?`, `weightKg?` | 200 perfil (upsert) |

### Alimentos personalizados

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| GET | `/api/nutrition/custom-foods/ingredients` | Auth | — | 200 `Ingredient[]` (**vacío hoy**) |
| POST | `/api/nutrition/custom-foods` | Auth | `name`, `description?`, `servingSize?`, `ingredients[]` (`ingredientId` UUID, `weightGrams`) | 201 `CustomFood` con macros calculados |
| GET | `/api/nutrition/custom-foods` | Auth | — | 200 `CustomFood[]` del usuario |
| PUT | `/api/nutrition/custom-foods/:id` | Auth | igual que POST | 200 `CustomFood` · 404 si no es dueño |
| DELETE | `/api/nutrition/custom-foods/:id` | Auth | — | 204 · 404 si no es dueño |

`ingredients` exige al menos un elemento. Los macros del alimento se derivan de los ingredientes; no se aceptan macros manuales.

### Entrenamientos

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/api/workouts` | Auth | `date`, `sport` (`strength`\|`running`\|`cycling`\|`yoga`\|`swimming`\|`other`), `durationMin`, `intensity` (`low`\|`medium`\|`high`), `caloriesBurned?`, `distanceKm?`, `loadVolumeKg?`, `notes?` | 201 `WorkoutEntry` |
| GET | `/api/workouts/recent` | Auth | — | 200 `{ workouts }` (10 últimos) |
| GET | `/api/workouts/:date` | Auth | — | 200 `{ date, totals, workouts }` |
| PUT | `/api/workouts/:id` | Auth | igual que POST | 200 `WorkoutEntry` · 403 si no es dueño |
| DELETE | `/api/workouts/:id` | Auth | — | 200 `{ message }` · 403 si no es dueño |

Si `caloriesBurned` se omite, se estima por MET. Si se envía, se marca `isManualCalories`.

### Estadísticas

| Método | Ruta | Auth | Query | Respuesta |
|---|---|---|---|---|
| GET | `/api/stats/daily/:date` | Auth | — | 200 resumen del día |
| GET | `/api/stats/weekly` | Auth | `startDate=YYYY-MM-DD` | 200 `{ startDate, endDate, totals, days[7] }` |
| GET | `/api/stats/monthly` | Auth | `month=YYYY-MM` | 200 `{ month, daysInMonth, totals, days[] }` |

### FatSecret (proxy)

| Método | Ruta | Auth | Query/Params | Respuesta |
|---|---|---|---|---|
| GET | `/api/fatsecret/search` | Auth | `query`, `page?` | 200 `{ results, page, total_results }` |
| GET | `/api/fatsecret/food/:id` | Auth | — | 200 alimento con `servings[]` |
| POST | `/api/fatsecret/import/:id` | Auth | — | 200 `Ingredient` (upsert por nombre) |

Requiere `FATSECRET_CLIENT_ID` y `FATSECRET_CLIENT_SECRET`; sin ellas responde 500.

### Strava

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/api/strava/auth` | Auth | 200 `{ url }` — URL de autorización |
| GET | `/api/strava/callback` | — (llega de Strava) | 302 al perfil con `?strava=success\|error` |
| GET | `/api/strava/status` | Auth | 200 `{ connected }` |
| POST | `/api/strava/sync` | Auth | 200 `{ success, message, count }` |

### Interno

| Método | Ruta | Key | Respuesta |
|---|---|---|---|
| GET | `/internal/summary/:userId/:date` | `x-internal-api-key` | 200 `{ userId, date, dietCompliant, workoutCompliant, details }` · 403 clave inválida · 503 sin clave configurada |

**Dormido**: ningún servicio lo consume hoy.

### Salud del servicio

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/health` | — | `{ service, status, timestamp }` |

---

## Totales

| Servicio | Endpoints |
|---|---|
| backend-core | 17 |
| backend-health | 27 |
| **Total** | **44** |

Recuento: `grep -rhoE "router\.(get|post|patch|put|delete)" apps/*/src/routes | wc -l` = 44 (2026-11-11).
