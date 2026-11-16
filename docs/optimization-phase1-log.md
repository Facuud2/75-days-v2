# Registro de Control y Verificación — Fase 1 (Optimistic UI `0ms` + *Stale-While-Revalidate*)

- **Rama Git:** `feat/zero-latency-optimization` (aislada de `main`)
- **Rama Neon Postgres:** `feat-zero-latency` (`br-crimson-math-bbsw2pkj`, aislada de `production` `br-blue-violet-bbml1xx3`)
- **Fecha de Ejecución:** 2026-11-16

---

## 1. Archivos Creados y Modificados en Fase 1

| Archivo | Cambio Realizado |
| :--- | :--- |
| `apps/frontend/store/useChallengeStore.ts` | Añadido `challengeSyncSeq` anti-carrera, *Stale-While-Revalidate* (`isLoading` vs `isValidating`), persistencia de `logs` en `localStorage` (omitiendo fotos Base64 `>100KB`), y **Optimistic UI de `0ms`** en `logDailyGoal` (actualiza `completed`, `status`, `streak` `±1` y `points` `±10` en el mismo frame con rollback automático) y `logDailyMetrics`. |
| `apps/frontend/store/useQuestStore.ts` | Añadido middleware `persist` (`quest-storage`), `questSyncSeq`, *Stale-While-Revalidate*, y **Optimistic UI de `0ms`** en `subscribeToQuest`, `createCustomQuest`, `toggleTask` y `restartQuest`. |
| `apps/frontend/store/useHealthStore.ts` *(Nuevo)* | Store centralizado y persistido (`health-storage`) para `profileData`, `dailyStatsByDate`, `recentWorkouts`, `isStravaConnected`, `customFoods` y los 51 `systemIngredients`, con *Stale-While-Revalidate* (`fetchProfileBundle`, `fetchCatalogIfNeeded`) y mutaciones optimistas en `0ms` (`logMealOptimistic`, `updateMealOptimistic`, `deleteMealOptimistic`, `logWorkoutOptimistic`, `updateWorkoutOptimistic`, `deleteWorkoutOptimistic`, `createCustomFoodOptimistic`, `applyOptimisticProfilePatch`). |
| `apps/frontend/store/useAuthStore.ts` | `logout()` limpia en memoria y en `localStorage` los tres stores (`useChallengeStore`, `useQuestStore`, `useHealthStore`). |
| `apps/frontend/lib/api/logs.ts` | Tipado explícito de `challengeStreak` y `challengePoints` en la respuesta de `updateGoalStatus`. |
| `apps/frontend/app/dashboard/page.tsx` | Eliminado el bloqueo de UI (`isLocked`, `opacity-40`, spinner reemplazando el check) al marcar metas diarias, permitiendo clics consecutivos en `0ms`. Esqueleto `<DashboardLoading />` restringido únicamente al primer arranque sin caché. |
| `apps/frontend/components/SideQuestDetailModal.tsx` | Eliminado el bloqueo `busy` y el spinner en tareas de misiones secundarias; `toggleTask` y `restartQuest` responden en `0ms`. |
| `apps/frontend/components/SideQuestsModal.tsx` | `handleSubscribe` y `handleCreate` actualizan el store y cierran el modal en `0ms`. |
| `apps/frontend/app/profile/page.tsx` | Conectado a `useHealthStore`. Navegar a `/profile` renderiza desde caché en `0ms` sin mostrar `<ProfileSkeleton />` y sin disparar cascadas de re-fetches tras editar perfil, comidas, entrenamientos o misiones. |
| `apps/frontend/components/LogMealModal.tsx` | Conectado a `useHealthStore`: abre con `customFoods` y los 51 `systemIngredients` en memoria (`0ms`), filtra ingredientes base localmente al escribir, y cierra el modal en `0ms` al registrar comida o crear platillo. |
| `apps/frontend/components/EditMealModal.tsx` | Conectado a `useHealthStore`: editar o eliminar alimento actualiza calorías/macros y cierra el modal en `0ms` con rollback automático si falla la red. |
| `apps/frontend/components/LogWorkoutModal.tsx` | Conectado a `useHealthStore`: registrar, editar o eliminar entrenamiento estima calorías MET, actualiza estadísticas/recientes y cierra el modal en `0ms`. |
| `apps/frontend/components/EditProfileSheet.tsx` | Guardar o quitar avatar/banner/nombre/frase actualiza el perfil y cierra el sheet en `0ms` con rollback automático en caso de error. |
| `apps/frontend/app/calendar/page.tsx` | Paraleliza `fetchCurrentChallenge` y `checkDailyReset` sin bloquear el mapa cuando existen datos en caché. |
| `apps/frontend/components/calendar/DayDetailsSheet.tsx` | Guardar peso, notas y foto actualiza `useChallengeStore` de forma optimista y cierra el sheet en `0ms`. |
| `apps/frontend/tests/phase1-optimistic-swr.test.ts` *(Nuevo)* | 8 tests unitarios que verifican mutaciones optimistas en `0ms`, rollback ante fallos de red y *Stale-While-Revalidate* en `useChallengeStore`, `useQuestStore` y `useHealthStore`. |

---

## 2. Verificación Ejecutada (Fase 1)

1. **Suite de Tests Unitarios (`vitest run`)**:
   - **8 archivos de test / 45 tests pasados (100% verde)**, incluyendo `tests/phase1-optimistic-swr.test.ts` (8 tests nuevos) y `tests/auth-session.test.ts`.
2. **Chequeo Estático de Tipos (`npx tsc --noEmit`)**:
   - **0 errores** de TypeScript.
3. **Build de Producción de Next.js (`npm run build`)**:
   - Compilación exitosa (`✓ Compiled successfully`, `✓ Generating static pages (16/16)`).

---

## 3. Fase 2: Eliminación de Waterfalls y Reducción a 1 Round-Trip por Vista (Patrón `/api/sync`)

| Archivo | Cambio Realizado |
| :--- | :--- |
| `apps/backend-core/src/utils/dailyReset.ts` *(Nuevo)* | Unifica la verificación de cambio de día (`checkDailyReset`) y la lectura del reto activo en un único flujo (`reconcileAndGetActiveChallenge`), ejecutando **1 sola query SQL** en lecturas del mismo día en lugar de 4–6 queries secuenciales. |
| `apps/backend-core/src/controllers/challengeController.ts` y `logController.ts` | `GET /api/challenges/current?timezoneOffset=...` y `POST /api/logs/check-reset` delegan en `reconcileAndGetActiveChallenge`. |
| `apps/backend-core/src/controllers/syncController.ts` y `routes/sync.ts` *(Nuevos)* | Endpoint BFF unificado `GET /api/sync` que resuelve en paralelo (`Promise.all`) reto activo + misiones del usuario + plantillas disponibles + perfil/logros en **1 round-trip**. |
| `apps/backend-health/src/controllers/syncController.ts` y `routes/sync.ts` *(Nuevos)* | Endpoint BFF unificado `GET /api/sync/:date` que resuelve en paralelo (`Promise.all`) estadísticas del día, estado de Strava (sin query extra), últimos 10 entrenamientos, comidas personalizadas y los 51 ingredientes base en **1 round-trip**. |
| `apps/frontend/lib/api/base.ts` | Deduplicación en memoria (`inFlightGetRequests`) de peticiones `GET` concurrentes idénticas (`client-swr-dedup`). |
| `apps/frontend/lib/api/sync.ts` *(Nuevo)* | Cliente `syncCoreStores` para hidratar `useChallengeStore`, `useQuestStore` y `useHealthStore` en 1 round-trip con fallback transparente para mocks de tests. |
| `apps/frontend/app/dashboard/page.tsx` y `app/profile/page.tsx` | `/dashboard` reduce su carga de **4 peticiones → 1 petición**; `/profile` reduce su carga de **7–9 peticiones → 2 peticiones en paralelo** (`:3001/api/sync` y `:3002/api/sync/:date`). |
| `apps/frontend/components/AuthGuard.tsx` y `app/onboarding/page.tsx` | Eliminado el ciclo extra de bloqueo de `onboardingChecked` para sesiones ya onboardeadas y paralelizado `Promise.all([startChallenge, completeOnboarding])`. |
| `apps/frontend/tests/phase2-sync-dedup.test.ts` *(Nuevo)* | 4 tests unitarios verificando deduplicación `GET`, supresión del `POST /logs/check-reset` redundante y sincronización en 1 round-trip en core y health. |

### Verificación Ejecutada (Fase 2)
- **Tests Unitarios (`npm run test:unit`)**: **9 suites / 49 tests pasados (100% verde)**.
- **Chequeo Estático de Tipos (`npx tsc --noEmit`)**: **0 errores** en `apps/frontend`, `apps/backend-core` y `apps/backend-health`.

---

## 4. Fase 3: Optimización SQL, Egress, Conexiones y Resiliencia en Backend (`neon-postgres`)

| Archivo | Cambio Realizado |
| :--- | :--- |
| `apps/backend-core/src/controllers/logController.ts` | `updateGoalStatus` reduce **9–10 queries secuenciales → 1 lectura con join (`dailyLog` + `goals` + `challenge`) + 1 batch de escrituras en paralelo (`Promise.all`)** dentro de la transacción. |
| `apps/backend-core/src/controllers/questController.ts` | `toggleQuestTask` reduce **5 queries secuenciales → 1 batch transaccional**; `fetchCachedAvailableQuestTemplates()` añade caché en memoria (`TTL 5 min`) y `Cache-Control`. |
| `apps/backend-core/src/controllers/userController.ts` | `buildUserProfilePayload` excluye `photoUrl` (Base64 pesado) y `notes` de `dailyLogs` (reducción drástica de egress) y paraleliza/omite escrituras de logros sin cambios (**F-05**). |
| `apps/backend-health/src/controllers/statsController.ts` | `getWeeklyStats` y `getMonthlyStats` reemplazan **15 a 63 queries N+1 por request → 3 queries concurrentes por rango (`date: { gte, lte }`)** agrupadas en memoria en $O(N)$ (**F-09**). |
| `apps/backend-health/src/controllers/stravaController.ts` y `lib/prisma.ts` | Elimina el `new PrismaClient()` duplicado (**F-16**), usa el singleton `healthPrisma`, y reduce la sincronización de Strava de **91 queries secuenciales → 2 queries en lote (`findMany` + `createMany`)**. |
| `apps/backend-health/src/controllers/customFoodController.ts` y `fatsecretController.ts` | Caché en memoria (`TTL 5 min`) de los 51 ingredientes base con invalidación automática al importar desde FatSecret. |
| `apps/backend-health/src/utils/asyncHandler.ts`, `routes/*` e `index.ts` | Wrapper `asyncHandler` en todas las rutas Express 4 y middleware global de errores para evitar peticiones colgadas ante rechazos async de Prisma (**F-08**). |
| `apps/frontend/components/calendar/DayDetailsSheet.tsx` y `DayDetailsModal.tsx` | Procesamiento de fotos de progreso con `URL.createObjectURL` + revocación inmediata en `finally` y compresión Canvas a `image/webp` (`<=640px`). |
| `apps/backend-core/src/__tests__/phase3-core-sql.test.ts` y `apps/backend-health/src/__tests__/phase3-health-sql.test.ts` *(Nuevos)* | Suites de tests unitarios para ambos backends ejecutables vía `npm test` (resolviendo además **F-20**). |

### Verificación Ejecutada (Fase 3)
- **`apps/backend-core` (`npm test` + `npx tsc --noEmit`)**: **2/2 tests pasados (100% verde)** y **0 errores TS**.
- **`apps/backend-health` (`npm test` + `npx tsc --noEmit`)**: **3/3 tests pasados (100% verde)** y **0 errores TS**.
- **`apps/frontend` (`npm run test:unit` + `npx tsc --noEmit`)**: **9 suites / 49 tests pasados (100% verde)** y **0 errores TS**.

---

## 5. Fase 4: Infraestructura Neon Postgres, Pre-Calentamiento de Pools y Resource Hints

| Archivo | Cambio Realizado |
| :--- | :--- |
| `apps/backend-core/src/utils/dbLifecycle.ts` y `apps/backend-health/src/utils/dbLifecycle.ts` *(Nuevos)* | Pre-calentamiento de pool Prisma (`$connect` + `SELECT 1` + cachés en RAM), `resolveDirectDatabaseUrl` (pooled vs unpooled) y `configureServerLifecycle` (`keepAliveTimeout: 65s`, `headersTimeout: 66s`, graceful shutdown `SIGTERM`/`SIGINT`). |
| `apps/backend-core/scripts/migrate-direct.js` y `apps/backend-health/scripts/migrate-direct.js` *(Nuevos)* | Ejecutan `prisma migrate deploy` usando conexión directa sin `-pooler` (`DIRECT_URL` / `DATABASE_URL_UNPOOLED` / strip automático de `-pooler.` en `.neon.tech`). |
| `apps/backend-core/src/index.ts` y `apps/backend-health/src/index.ts` | Preflight CORS cacheado (`maxAge: 86_400`), `/health?deep=1`, warmup al arrancar y ciclo de vida HTTP limpio. |
| `apps/backend-core/prisma.config.ts`, `package.json` y `.env.example` (ambos backends) | Scripts `start` y `db:migrate` cableados a `migrate-direct.js` y documentación de `DATABASE_URL` (`-pooler`) vs `DATABASE_URL_UNPOOLED`. |
| `neon.ts` | Política de ramas con `ttl: "7d"` y `computeSettings` scale-to-zero (`0.25–1 CU`, `suspendTimeout: "5m"`) para nuevas ramas de desarrollo. |
| `apps/frontend/app/layout.tsx` y `apps/frontend/next.config.ts` | `<link rel="preconnect">` y `<link rel="dns-prefetch">` para ambos backends y `optimizePackageImports: ['lucide-react', 'date-fns', 'motion']`. |
| `apps/backend-core/src/__tests__/phase4-neon-lifecycle.test.ts` y `apps/backend-health/src/__tests__/phase4-neon-lifecycle.test.ts` *(Nuevos)* | 6 tests unitarios cubriendo resolución de URL directa Neon, warmup de pools/cachés y tuning Keep-Alive. |

### Verificación Final (Fase 4 — Monorepo Completo)
- **`apps/backend-core`**: `npm test` (**5/5 pasados**), `npx tsc --noEmit` (**0 errores**), `npm run build` (**exitoso**).
- **`apps/backend-health`**: `npm test` (**6/6 pasados**), `npx tsc --noEmit` (**0 errores**), `npm run build` (**exitoso**).
- **`apps/frontend`**: `npm run test:unit` (**9 suites / 51 tests pasados**), `npx tsc --noEmit` (**0 errores**), `npm run build` (**exitoso**, `16/16` rutas).
