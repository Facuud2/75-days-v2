# Config Reference

> Ancla: `process.env` leído en `apps/backend-core/src` y `apps/backend-health/src`, y `NEXT_PUBLIC_*` en `apps/frontend`.
> Confianza: **Leído** (búsqueda de cada clave contra el código). Los "muerto" se probaron con búsqueda de referencias.

Cada clave indica si el código la lee realmente. Una clave que nadie lee es un **knob muerto**: existe en el `.env` pero no cambia nada.

## backend-core

| Clave | Default en código | Leída por | Estado |
|---|---|---|---|
| `DATABASE_URL` | — (obligatoria) | Prisma | Viva · obligatoria |
| `JWT_SECRET` | `fallback_secret_key_change_me_in_prod` | `middlewares/auth`, `authController` | Viva · **peligrosa por el fallback** |
| `PORT` | `3001` | `index.ts` | Viva |
| `NODE_ENV` | — | `utils/prisma.ts` (singleton en dev) | Viva |
| `HEALTH_SERVICE_URL` | `http://localhost:3002` | `utils/healthClient.ts` | **Muerta** — el archivo nunca se importa |
| `INTERNAL_API_KEY` | `''` | `utils/healthClient.ts` | **Muerta** por la misma razón |
| `FRONTEND_URL` | — | nadie en core | **Muerta** — solo la lee `backend-health` |

## backend-health

| Clave | Default en código | Leída por | Estado |
|---|---|---|---|
| `DATABASE_URL` | — (obligatoria) | Prisma | Viva · obligatoria |
| `JWT_SECRET` | `fallback_secret_key_change_me_in_prod` | `middlewares/auth` | Viva · **debe coincidir con core** |
| `INTERNAL_API_KEY` | — | `middlewares/internalAuth` | Viva (canal dormido) |
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
| `GEMINI_API_KEY` | — | nadie | **Muerta** — `@google/genai` está instalado pero nunca se importa |
| `APP_URL` | — | nadie | **Muerta** — sin referencias en el código |

## Reglas de consistencia

1. **`JWT_SECRET` debe ser idéntico en ambos backends.** Es lo que permite que un token emitido por `backend-core` valide en `backend-health`. Si difieren, todo el servicio de salud responde 401.
2. **`INTERNAL_API_KEY` debe ser idéntico en ambos** para el canal interno. Si falta en health, el canal responde 503; si difiere, 403.
3. **`DATABASE_URL` debe apuntar a bases distintas** (`75days` y `75days_health`). Apuntar ambas a la misma base mezcla dos esquemas sin relación.

## Rareza: carga implícita de `dotenv`

Varias claves se leen en constantes de módulo (`const JWT_SECRET = process.env.JWT_SECRET || ...`), evaluadas al importar el archivo. `dotenv.config()` se llama en el punto de entrada, después de los imports.

**Medido**: el `.env` sí se aplica, porque `@prisma/client` carga `dotenv` por su cuenta al importarse, y en la práctica los controladores importan Prisma antes que el middleware de auth. Pero eso significa que **el orden de los imports decide qué secreto se usa**. Si un archivo importara el middleware de auth antes que Prisma, tomaría silenciosamente el fallback hardcodeado.

No es un bug activo; es una dependencia frágil que conviene eliminar cargando la configuración en un módulo dedicado, importado primero. Ver `findings.md` F-11.
