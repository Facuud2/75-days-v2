# Findings

> Ancla: código en `HEAD` (`734dad9`) y servicios corriendo el 2026-11-11.
> Confianza: **Leído** salvo los marcados **Medido**.

Notas para el dueño. No son un plan de trabajo ni una auditoría de severidad: son observaciones verificadas, con la ubicación para retomarlas. El orden es aproximado por impacto.

| ID | Hallazgo | Evidencia | Estado |
|---|---|---|---|
| **F-07** | `SideQuestTemplate` y `Achievement` no existen en la base. `GET /quests/available` y `GET /users/profile` devuelven 500. `prisma migrate status` miente: dice "up to date". | `apps/backend-core/prisma/migrations/` (solo 3 migraciones); **Medido** por SQL y HTTP | **Resuelto 2026-11-11** — migración `20261111031957` |
| **F-10** | El catálogo de ingredientes está vacío (`baseIngredients: []`). Sin credenciales de FatSecret no se puede crear ningún alimento personalizado. | `apps/backend-health/prisma/seed.ts:5`; **Medido** (`GET .../ingredients` → `[]`) | **Resuelto 2026-11-11** — 51 ingredientes |
| **F-04** | El cierre del día y la ruptura de racha dependen de que el cliente llame a `check-reset`. Sin conexión, la racha no se rompe. | `apps/backend-core/src/controllers/logController.ts:165-253`; llamada desde `apps/frontend/lib/api/logs.ts:30` | Diseño frágil |
| **F-05** | `GET /users/profile` escribe en la base: recalcula y persiste logros en cada lectura, con escrituras por logro. | `apps/backend-core/src/controllers/userController.ts:102-141` | Diseño frágil |
| **F-01** | `register` acepta `difficulty: "Custom"` sin `customGoalsTemplate` y revienta con 500 (`DEFAULT_GOALS['Custom']` es `undefined`). `start` sí lo valida. | `apps/backend-core/src/controllers/authController.ts:64-66` vs `challengeController.ts:76-78` | **Resuelto 2026-11-11** — 400 con `Custom` sin metas |
| **F-02** | Las metas por defecto están duplicadas con contenido distinto en dos controladores. Registrarse y luego iniciar reto con la misma dificultad da metas distintas. | `authController.ts:16-46` y `challengeController.ts:40-61` | Bug de consistencia |
| **F-06** | El "peso actual" del perfil es el **mejor** peso registrado, no el último. | `userController.ts:150` (`currentWeight: bestWeight`) | Semántica confusa |
| **F-08** | Express 4 sin manejo de errores async: si Prisma falla en nutrición, workouts, custom foods o stats, la petición queda colgada (no responde 500). | `apps/backend-health/src/controllers/nutritionController.ts` (sin try/catch), `index.ts` (sin error handler) | Bug latente |
| **F-03** | Puntos y racha se calculan con lectura + escritura no atómica. Dos marcas concurrentes pueden perder una actualización. | `logController.ts:73-92` | **Resuelto 2026-11-11** — advisory lock por día |
| **F-11** | `JWT_SECRET` e `INTERNAL_API_KEY` se leen en constantes de módulo antes de `dotenv.config()`. Funciona por efecto colateral de Prisma cargando `dotenv`; depende del orden de imports. | `apps/backend-core/src/middlewares/auth.ts:4`, `apps/backend-health/src/middlewares/internalAuth.ts:3` | Fragilidad |
| **F-12** | `JWT_SECRET` tiene un fallback hardcodeado idéntico en tres archivos. Si falta el env, la app arranca con un secreto público. | `backend-core/src/middlewares/auth.ts:4`, `backend-core/src/controllers/authController.ts:9`, `backend-health/src/middlewares/auth.ts:4` | Seguridad |
| **F-13** | CORS abierto (`cors()` sin `origin`) en ambos servicios. | `backend-core/src/index.ts:17`, `backend-health/src/index.ts:19` | Seguridad |
| **F-14** | El `state` OAuth de Strava es el `userId` en claro: no protege CSRF en el callback. | `apps/backend-health/src/controllers/stravaController.ts:25,46` | Seguridad |
| **F-15** | Tokens de Strava guardados en claro en la base. | `apps/backend-health/prisma/schema.prisma:23-26` | Seguridad |
| **F-16** | `stravaController` instancia su propio `PrismaClient` en vez de usar el singleton. | `apps/backend-health/src/controllers/stravaController.ts:7` | Deuda |
| **F-09** | Estadísticas semanal/mensual hacen 2 consultas por día (14 a 62 por request), sin caché. | `apps/backend-health/src/controllers/statsController.ts:20-24,102,136` | Performance |
| **F-17** | `healthClient.ts` (cliente core→health) nunca se importa. Canal interno dormido. | búsqueda de `healthClient` sin importadores | Código muerto |
| **F-18** | `challengesCompleted` nunca se incrementa; el logro "Disciplina" nunca puede desbloquearse. | `userController.ts:47` lee el campo; ningún `update` lo escribe | Bug funcional |
| **F-19** | `console.log("HITTING AVAILABLE QUESTS")` en cada request del catálogo de misiones. | `apps/backend-core/src/controllers/questController.ts:22` | Limpieza |
| **F-20** | No hay tests. `npm test` devuelve error explícito. | `apps/backend-core/package.json:6`, `backend-health` sin script | Bloqueante para migrar |
| **F-21** | `backend-health` no tiene migraciones: esquema aplicado con `db push`, sin historial. | ausencia de `prisma/migrations` en health | Riesgo |
| **F-22** | `externalId` de `WorkoutEntry` es único global, no por usuario. | `apps/backend-health/prisma/schema.prisma:64` | Modelo |
| **F-23** | El balance neto resta lo quemado, pero "restante para la meta" no lo descuenta. Dos criterios en la misma respuesta. | `apps/backend-health/src/controllers/statsController.ts:34-42` | Semántica |
| **F-24** | `date` es `String` sin validación de formato en los endpoints de logs de core (health sí valida). | `logController.ts:36,125` | Validación |
| **F-25** | `GoalTemplate` y `DailyGoal` no tienen unicidad; nada impide metas duplicadas en el mismo día. | `apps/backend-core/prisma/schema.prisma:44-78` | Modelo |
| **F-26** | `FRONTEND_URL` está en el `.env` de core pero ningún archivo de core la lee. | búsqueda de `process.env.FRONTEND_URL` | Knob muerto |
| **F-27** | `NODE_ENV` está en el `.env` de health pero nadie lo lee. | búsqueda de `process.env.NODE_ENV` | Knob muerto |
| **F-28** | `APP_URL` está en el `.env.example` del frontend sin referencias en el código. | búsqueda de `APP_URL` | Knob muerto |
| **F-29** | No hay rate limiting en login ni registro. | `apps/backend-core/src/routes/auth.ts` | Seguridad |
| **F-30** | El registro permite contraseñas de 6 caracteres y no exige complejidad. | `apps/backend-core/src/controllers/authController.ts:12` | Seguridad |
| **F-31** | El perfil usa `Promise.all` sin capturar el fallo de `getProfile`. Si ese endpoint devuelve 500 (hoy lo hace), se pierden **también** los datos de salud y de Strava que sí respondían. | `apps/frontend/app/profile/page.tsx:75-91` | Bug visible hoy |
| **F-32** | El frontend tiene dos clientes HTTP: `apiClient` (fetch, lee el token de `localStorage`) y un axios propio en `useQuestStore` (lee el token del store). Manejan 401 distinto: solo el primero redirige al login. | `apps/frontend/lib/api/client.ts:3-17` y `apps/frontend/store/useQuestStore.ts:4-18` | Inconsistencia |
| **F-33** | `/dashboard` figura en `PUBLIC_ROUTES`, así que el guard no la protege. La página carga igual, pero sus llamadas reciben 401 y el `apiClient` redirige al login. | `apps/frontend/components/AuthGuard.tsx:8` | Inconsistencia |
| **F-34** | `@google/genai` y `GEMINI_API_KEY` no se usan en ningún archivo: dependencia y knob muertos. | búsqueda de `genai`/`GEMINI` en `apps/frontend` sin resultados | Limpieza |
| **F-35** | El frontend recalcula el día del reto por su cuenta (`fetchCurrentChallenge`) con una fórmula propia, duplicando la lógica del backend y sin usar el `timezoneOffset`. | `apps/frontend/store/useChallengeStore.ts:104-114` | Duplicación |
| **F-36** | `challenge-storage` persiste solo `isActive/streak/currentDay/points/achievements/bestWeight`. **`startDate` y `difficulty` se pierden en cada reload**, y `check-reset` no los devuelve. Tras recargar, `/calendar` muestra "No Active Challenge" y el dashboard pinta el plan como `HARD` por defecto. | `apps/frontend/store/useChallengeStore.ts:288-295`; `apps/frontend/app/calendar/page.tsx:8-17` | Bug visible |
| **F-37** | `logout` limpia auth y resetea el tema, pero **no limpia `challenge-storage`**. Al cambiar de cuenta se ven racha, puntos y reto del usuario anterior hasta que algo los pise. | `apps/frontend/store/useAuthStore.ts:64-68` | Bug de privacidad |
| **F-38** | No existe `@custom-variant dark` en `globals.css`: en Tailwind v4 el variant `dark:` sigue a `prefers-color-scheme`, no a la clase `.dark` ni a `data-appearance`. **El toggle de tema no controla las clases `dark:`** (body, spinner, dashboard, calendario). | `apps/frontend/app/globals.css:1` | Bug visual |
| **F-39** | El login imprime email y **contraseña en claro** por consola. | `apps/frontend/app/login/page.tsx:18` | Seguridad |
| **F-40** | El modal de entrenamiento ofrece `walking` ("Caminata"), pero el enum del backend no lo acepta: guardar una caminata devuelve 400. | `apps/frontend/components/LogWorkoutModal.tsx:20` vs `apps/backend-health/src/controllers/workoutController.ts:11` | Bug visible |
| **F-41** | Dos criterios de "hoy": los modales globales del layout usan fecha **UTC** y el perfil usa fecha **local**. En husos negativos, después de las 21:00 se registra en el día siguiente desde el header. | `apps/frontend/components/Layout.tsx:183-184` vs `apps/frontend/app/profile/page.tsx:964` | Bug de datos |
| **F-42** | Hay **dos sistemas paralelos de misiones**: `useChallengeStore.sideQuests` y `useQuestStore.quests`. El onboarding escribe en el primero; dashboard y perfil leen del segundo. Las misiones adoptadas en el onboarding no aparecen en el dashboard. | `apps/frontend/store/useChallengeStore.ts:224-260`; `apps/frontend/store/useQuestStore.ts:40-113`; `apps/frontend/app/onboarding/page.tsx:14,77` | Bug funcional |
| **F-43** | `/onboarding` está exenta del guard: se puede abrir sin sesión. Los endpoints fallan con 401 y la página no lo maneja. | `apps/frontend/components/AuthGuard.tsx:55-57` | Inconsistencia |
| **F-44** | `tw-animate-css` está en dependencias pero **no se importa** en `globals.css`. Las 17 clases `animate-in`, `fade-in`, `slide-in-from-*` y `zoom-in-95` no hacen nada. | `apps/frontend/app/globals.css:1` | Bug visual |
| **F-45** | El dashboard no pide el reto cuando `isActive` es `false`: solo lo hace dentro del branch `isActive` o si los logs quedan vacíos tras `check-reset`. Con storage limpio, `isActive=false` y el componente devuelve `null` → **dashboard en blanco** aunque haya reto activo. | `apps/frontend/app/dashboard/page.tsx:53-86` | Bug visible |
| **F-46** | `checkDailyReset` hace `logs.reduce` sin comprobar que `logs` exista. Si no hay reto activo, el backend responde `{ message }` sin `logs` y el store revienta. | `apps/frontend/store/useChallengeStore.ts:266-272`; `apps/backend-core/src/controllers/logController.ts:183-185` | Bug latente |
| **F-47** | `/calendar` es una ruta muerta: ningún componente la enlaza y sus celdas tienen `cursor-pointer` pero sin `onClick`, así que no abren el detalle del día. | `apps/frontend/app/calendar/page.tsx:85`; sin `Link` a `/calendar` en el resto | Código muerto |

## Cómo se verificaron los dos bloqueantes (ya resueltos)

```bash
# F-07 — resuelto con la migración 20261111031957
docker exec 75days-postgres psql -U dev -d 75days -c '\dt'
# → SideQuestTemplate y Achievement presentes
curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/quests/available -H "Authorization: Bearer $TOKEN"
# → 200
curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/users/profile -H "Authorization: Bearer $TOKEN"
# → 200

# F-10 — resuelto con el seed de 51 ingredientes
curl -s localhost:3002/api/nutrition/custom-foods/ingredients -H "Authorization: Bearer $TOKEN" | jq length
# → 51
# POST /api/nutrition/custom-foods con un ingredientId real → 201
```

## Lo que **no** se pudo determinar

- Si la ausencia de las tablas fue un descuido o una decisión (por ejemplo, dejar la funcionalidad a medias). El código de logros y misiones está completo y cableado, lo que sugiere descuido de migración.
- Si el canal core→health estaba previsto para una fase posterior o quedó abandonado.
- El contenido real del `.env` de producción: el repo nunca lo tuvo.
