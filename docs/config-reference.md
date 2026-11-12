# Config Reference

> Ancla: `process.env` leído en `apps/backend-core/src` y `apps/backend-health/src`, y `NEXT_PUBLIC_*` en `apps/frontend`.
> Confianza: **Leído** (búsqueda de cada clave contra el código). Los "muerto" se probaron con búsqueda de referencias.

Cada clave indica si el código la lee realmente. Una clave que nadie lee es un **knob muerto**: existe en el `.env` pero no cambia nada.

## backend-core

| Clave | Default en código | Leída por | Estado |
|---|---|---|---|
| `DATABASE_URL` | — (obligatoria) | Prisma | Viva · obligatoria |
| `JWT_SECRET` | — (obligatoria) | `config.ts`, auth middleware/controller | Viva · el proceso falla al arrancar si falta |
| `PORT` | `3001` | `index.ts` | Viva |
| `NODE_ENV` | — | `utils/prisma.ts` (singleton en dev) | Viva |
| `HEALTH_SERVICE_URL` | `http://localhost:3002` | `utils/healthClient.ts` | **Muerta** — el archivo nunca se importa |
| `INTERNAL_API_KEY` | — (obligatoria) | `config.ts`, `utils/healthClient.ts` | Viva · el proceso falla al arrancar si falta |
| `FRONTEND_URL` | — | `index.ts` | Viva · lista de orígenes CORS separados por comas |

## backend-health

| Clave | Default en código | Leída por | Estado |
|---|---|---|---|
| `DATABASE_URL` | — (obligatoria) | Prisma | Viva · obligatoria |
| `JWT_SECRET` | — (obligatoria) | `config.ts`, `middlewares/auth` | Viva · el proceso falla al arrancar si falta; debe coincidir con core |
| `INTERNAL_API_KEY` | — (obligatoria) | `config.ts`, `middlewares/internalAuth` | Viva (canal dormido); el proceso falla al arrancar si falta |
| `PORT` | `3002` | `index.ts` | Viva |
| `FRONTEND_URL` | `http://localhost:3000` | `stravaController` (redirect del callback) | Viva |
| `STRAVA_CLIENT_ID` | — | `stravaController` | Viva · opcional (sin ella, `/auth` → 500) |
| `STRAVA_CLIENT_SECRET` | — | `stravaController` | Viva · opcional |
| `STRAVA_REDIRECT_URI` | `http://localhost:3002/api/strava/callback` | `stravaController` | Viva · debe coincidir con la configurada en Strava |
| `FATSECRET_CLIENT_ID` | — | `lib/fatsecret.ts` | Viva · opcional (sin ella, proxy → 500) |
| `FATSECRET_CLIENT_SECRET` | — | `lib/fatsecret.ts` | Viva · opcional |
| `NODE_ENV` | — | nadie | **Muerta** |

## frontend

| Clave | Default en código | Leída por | Estado |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | `lib/api/client.ts`, `store/useQuestStore.ts` | Viva |
| `NEXT_PUBLIC_HEALTH_API_URL` | `http://localhost:3002/api` | `lib/api/health.ts` | Viva |
| `GEMINI_API_KEY` | — | nadie | **Eliminada** — Gemini no forma parte del producto |
| `APP_URL` | — | nadie | **Muerta** — sin referencias en el código |

## Reglas de consistencia

1. **`JWT_SECRET` debe ser idéntico en ambos backends.** Es lo que permite que un token emitido por `backend-core` valide en `backend-health`. Si difieren, todo el servicio de salud responde 401.
2. **`INTERNAL_API_KEY` debe ser idéntico en ambos** para el canal interno. Si falta, el servicio correspondiente no arranca; si difiere, health responde 403.
3. **`DATABASE_URL` debe apuntar a bases distintas** (`75days` y `75days_health`). Apuntar ambas a la misma base mezcla dos esquemas sin relación.

## Carga de configuración

Los secretos se cargan mediante `src/config.ts` en cada backend. El módulo ejecuta `dotenv.config()`, valida las variables obligatorias y lanza un error explícito si faltan; no existe fallback hardcodeado ni dependencia del orden de imports.
