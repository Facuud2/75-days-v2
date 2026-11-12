# Guía de liberación a producción

## Decisión recomendada de infraestructura

El sistema no es un único servicio: necesita **dos backends, un frontend y dos bases lógicas**.

### Opción recomendada para la primera publicación

- Render Web Service: `backend-core`.
- Render Web Service: `backend-health`.
- Vercel Project: `frontend` (recomendado para Next.js).
- PostgreSQL gestionado con dos bases (`75days` y `75days_health`) o dos instancias PostgreSQL separadas.

Los dos backends permanecen en Render y el frontend se publica en Vercel. No conviene intentar que los backends compartan una única URL de base sin confirmar que el proveedor permite crear y usar dos bases lógicas. La alternativa más simple y segura es una base gestionada por servicio, o un proveedor PostgreSQL externo que permita ambas bases.

## Paso 0 — No reutilizar datos de desarrollo

Producción debe empezar vacía. No subir `.env`, `node_modules`, `dist`, `.next` ni dumps de desarrollo.

Antes de crear servicios:

```bash
git status
git log --oneline -5
```

Confirmar que el working tree esté limpio y que el commit que se despliega incluya las migraciones, seeds y documentación.

## Paso 1 — Crear PostgreSQL

Crear las dos bases y guardar las URLs privadas. No usar `localhost` en Render.

```text
CORE_DATABASE_URL=postgresql://.../75days
HEALTH_DATABASE_URL=postgresql://.../75days_health
```

Si el proveedor entrega una sola base y permite crear otra mediante `psql`, ejecutar una vez:

```sql
CREATE DATABASE 75days_health;
```

No ejecutar `docker/initdb/01-create-health-db.sql` contra producción a ciegas: ese script está pensado para el primer arranque local del contenedor.

## Paso 2 — Generar secretos de producción

Generar secretos diferentes de los locales y no publicarlos en Git:

```bash
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # INTERNAL_API_KEY
```

`JWT_SECRET` debe ser **exactamente el mismo** en core y health. `INTERNAL_API_KEY` también debe coincidir entre ambos servicios aunque hoy el canal core → health no esté cableado. Nunca usar los valores `change_me...` de los ejemplos.

## Paso 3 — Configurar `backend-core` en Render

- Root directory: `apps/backend-core`.
- Build command:

```bash
npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
```

- Start command:

```bash
npm run db:seed && npm start
```

- Variables:

```text
NODE_ENV=production
PORT=10000
DATABASE_URL=<URL de 75days>
JWT_SECRET=<secreto compartido>
INTERNAL_API_KEY=<secreto interno compartido>
HEALTH_SERVICE_URL=<URL privada o pública de backend-health>
FRONTEND_URL=<URL pública del frontend>
```

Render suele inyectar `PORT`; el backend debe escuchar ese valor en producción. Verificar que `src/index.ts` no fuerce exclusivamente `3001` antes del deploy definitivo.

## Paso 4 — Configurar `backend-health` en Render

- Root directory: `apps/backend-health`.
- Build command:

```bash
npm ci && npx prisma generate && npm run build
```

- Start command inicial para una base vacía:

```bash
npx prisma migrate deploy && npm run db:seed && npm start
```

La migración baseline `20261111040000_init` crea el esquema actual y deja los cambios futuros auditables. No usar `db push` ni `--accept-data-loss` en producción.

- Variables:

```text
NODE_ENV=production
PORT=10000
DATABASE_URL=<URL de 75days_health>
JWT_SECRET=<el mismo secreto de core>
INTERNAL_API_KEY=<el mismo secreto interno>
FRONTEND_URL=<URL pública del frontend>
FATSECRET_CLIENT_ID=<opcional>
FATSECRET_CLIENT_SECRET=<opcional>
STRAVA_CLIENT_ID=<opcional>
STRAVA_CLIENT_SECRET=<opcional>
STRAVA_REDIRECT_URI=https://<health-host>/api/strava/callback
```

Si FatSecret y Strava no se van a usar inicialmente, dejarlos vacíos y no incluir callbacks de prueba.

## Paso 5 — Configurar `frontend` en Vercel

- Root directory: `apps/frontend`.
- Framework preset: `Next.js`.
- Build command (Vercel lo detecta automáticamente):

```bash
npm ci && npm run build
```

- Variables de entorno de producción:

```text
NEXT_PUBLIC_API_URL=https://seven5-days-v2.onrender.com/api
NEXT_PUBLIC_HEALTH_API_URL=https://seven5-days-v2-1.onrender.com/api
```

No configurar `GEMINI_API_KEY`: Gemini fue eliminado deliberadamente del producto. En Vercel no se necesita `PORT` ni un `start command` personalizado.

## Paso 6 — Orden de primer deploy

1. Crear las bases vacías.
2. Desplegar `backend-core`; confirmar migraciones y seed.
3. Desplegar `backend-health`; confirmar esquema y seed de 51 ingredientes.
4. Crear el proyecto de Vercel apuntando a `apps/frontend`.
5. Añadir las dos variables `NEXT_PUBLIC_*` en Vercel y desplegar el frontend.
6. Configurar la URL de Vercel como `FRONTEND_URL` en ambos servicios de Render y redeployar ambos backends para activar CORS.
7. Abrir la aplicación en una ventana incógnito.
8. Registrar un usuario nuevo y completar onboarding.
9. Verificar una misión, una comida, una caminata y una meta diaria.

Para previews de Vercel, se puede usar una lista separada por comas en `FRONTEND_URL`, por ejemplo `https://mi-app.vercel.app,https://mi-app-git-main-mi-equipo.vercel.app`.

## Variables de Render ya existentes

Las URLs públicas actuales son:

```text
CORE:   https://seven5-days-v2.onrender.com
HEALTH: https://seven5-days-v2-1.onrender.com
```

En `backend-core`, `HEALTH_SERVICE_URL` debe apuntar a `https://seven5-days-v2-1.onrender.com`. En ambos servicios, `JWT_SECRET` debe ser idéntico y `INTERNAL_API_KEY` debe ser idéntico. Cada servicio debe tener su propia `DATABASE_URL` de Neon: core a `75days` y health a `75days_health`.

## Smoke checklist post-deploy

```bash
curl -f https://<core-host>/health
curl -f https://<health-host>/health
```

Después, con un token nuevo:

- registro → 201;
- login → JWT;
- `/api/challenges/current` → 200;
- `/api/quests/available` → 200 y 3 plantillas;
- `/api/nutrition/custom-foods/ingredients` → 200 y 51 ingredientes;
- `POST /api/workouts` con `sport: walking` → 201;
- crear alimento personalizado → 201;
- cerrar sesión y confirmar que no quedan datos de la cuenta anterior.

## Rollback

- No borrar la base ante un fallo de aplicación.
- Revertir el servicio al commit anterior desde Render.
- Mantener el backup previo a cada cambio de esquema.
- No ejecutar `db push --accept-data-loss` como mecanismo de rollback.

## Pendientes antes de llamar a producción “estable”

1. Restringir CORS al dominio real del frontend.
2. Configurar logs, alertas, backups automáticos y dominio HTTPS.
3. Ejecutar el laboratorio local de edge cases en `/dev/edge-cases`.
