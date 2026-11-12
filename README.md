# 75 Days Challenge

Monorepo de la app **75 Days Challenge**: seguimiento de retos de 75 días con metas diarias, nutrición, entrenamientos y estadísticas.

> Este README se reconstruyó el **2026-11-11** leyendo el código, después de ~8 meses de inactividad (último commit: 2026-03-12). Documenta lo que el sistema **hace hoy**, no lo que debería hacer.

---

## Arquitectura

```
┌─────────────────┐
│   frontend      │  Next.js 15 · React 19 · Tailwind 4 · Zustand
│   :3000         │
└────────┬────────┘
         │  JWT (Bearer)
    ┌────┴─────────────────────┐
    ▼                          ▼
┌─────────────────┐   ┌──────────────────────┐
│ backend-core    │   │ backend-health       │
│ :3001           │◄──┤ :3002                │
│ Express 5       │   │ Express 4            │
│ Prisma 6        │   │ Prisma 6             │
└────────┬────────┘   └──────────┬───────────┘
         │                       │
         ▼                       ▼
   ┌───────────┐          ┌──────────────────┐
   │  75days   │          │  75days_health   │
   │ Postgres  │          │  Postgres        │
   └───────────┘          └──────────────────┘
```

**Dos bases separadas.** No hay foreign keys entre ellas: la relación usuario↔datos de salud se hace por `userId` a nivel de aplicación.

**Dos mecanismos de autenticación:**
- `JWT` (mismo `JWT_SECRET` en ambos servicios) → los tokens de `backend-core` son válidos en `backend-health`.
- `x-internal-api-key` (`INTERNAL_API_KEY`) → para llamadas servicio-a-servicio en rutas `/internal/*`.

---

## Stack

| App | Runtime | Framework | ORM | Puerto |
|---|---|---|---|---|
| `apps/frontend` | Node 22+ | Next 15.5 / React 19 / Tailwind 4 | — | 3000 |
| `apps/backend-core` | Node 22+ | Express 5 | Prisma 6 (migraciones) | 3001 |
| `apps/backend-health` | Node 22+ | Express 4 | Prisma 6 (migraciones) | 3002 |

Dependencias compartidas: `zod 4`, `date-fns 4`, `jsonwebtoken`, `bcryptjs`, `axios`.

---

## Quick start

### Opción A — Docker Compose (recomendada)

```bash
# 1. Crear los .env locales a partir de los ejemplos
cp apps/backend-core/.env.example apps/backend-core/.env
cp apps/backend-health/.env.example apps/backend-health/.env
cp apps/frontend/.env.example apps/frontend/.env.local

# 2. Completar JWT_SECRET / INTERNAL_API_KEY (deben coincidir en ambos backends)
openssl rand -hex 32

# 3. Levantar todo
docker compose up
```

### Opción B — Local (sin Docker para las apps)

Requiere PostgreSQL 16 corriendo en `localhost:5432`.

```bash
# Base de datos
createdb 75days
createdb 75days_health

# Backends
cd apps/backend-core   && npm install && npx prisma generate && npx prisma migrate deploy && npm run db:seed && npm run dev
cd apps/backend-health && npm install && npx prisma generate && npx prisma migrate deploy && npm run db:seed && npm run dev

# Frontend
cd apps/frontend && npm install && npm run dev
```

### Verificación

```bash
curl http://localhost:3001/health   # {"status":"ok"}
curl http://localhost:3002/health   # {"service":"backend-health","status":"ok",...}
open http://localhost:3000
```

---

## Variables de entorno

### `apps/backend-core/.env`

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres de core (`75days`) |
| `JWT_SECRET` | ✅ | Debe coincidir con health |
| `INTERNAL_API_KEY` | ✅ | Secreto compartido con health |
| `HEALTH_SERVICE_URL` | ✅ | `http://localhost:3002` |
| `FRONTEND_URL` | ⬜ | CORS / links |
| `PORT` | ⬜ | Default 3001 |

### `apps/backend-health/.env`

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres de health (`75days_health`) |
| `JWT_SECRET` | ✅ | Debe coincidir con core |
| `INTERNAL_API_KEY` | ✅ | Secreto compartido con core |
| `FRONTEND_URL` | ⬜ | CORS / links |
| `FATSECRET_CLIENT_ID` / `_SECRET` | ⬜ | Integración FatSecret (vacío = desactivada) |
| `STRAVA_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | ⬜ | Integración Strava (vacío = desactivada) |

### `apps/frontend/.env.local`

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:3001/api` |
| `NEXT_PUBLIC_HEALTH_API_URL` | ✅ | `http://localhost:3002/api` |
| `GEMINI_API_KEY` | ⬜ | Features de IA (vacío = desactivadas) |

---

## Mapa de API

### `backend-core` (`/api`)

| Recurso | Rutas |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/complete-onboarding`, `GET /auth/onboarding-status` |
| Challenges | `/challenges/*` |
| Logs | `/logs/*` |
| Quests | `/quests/*` |
| Users | `/users/*` |

### `backend-health`

| Recurso | Rutas |
|---|---|
| Nutrición | `GET/PUT /api/nutrition/goals`, `GET /api/nutrition/meals/:date`, `POST /api/nutrition/meals` |
| Alimentos | `GET /api/nutrition/search`, `GET /api/nutrition/food/:id`, `GET /api/nutrition/ingredients` |
| Comidas custom | `/api/nutrition/custom-foods/*` |
| Workouts | `POST /api/workouts`, `GET /api/workouts/:date`, `GET /api/workouts/recent` |
| Stats | `GET /api/stats/daily/:date`, `/api/stats/weekly`, `/api/stats/monthly` |
| Integraciones | `/api/fatsecret/*`, `/api/strava/*` |
| Interno | `/internal/*` (requiere `x-internal-api-key`) |

---

## Estado del proyecto (auditoría 2026-11-11)

### ✅ Funciona
- Los 3 servicios levantan y responden.
- Registro → JWT → `/auth/me` → creación automática de challenge con metas por dificultad.
- Token de core aceptado por health (JWT interoperable).
- Guards de auth: 401 sin token, 403 con API key inválida.
- Esquemas aplicados en ambas DB mediante migraciones (core con 4 migraciones, health con baseline versionado).
- Misiones secundarias y logros operativos: `SideQuestTemplate` y `Achievement` existen en la base (migración `20261111031957`).
- Catálogo de 51 ingredientes base sembrado; se pueden crear alimentos personalizados de punta a punta.

### ⚠️ Deuda conocida
| # | Problema | Impacto |
|---|---|---|
| 1 | **Cero tests** (`npm test` → `exit 1`) | Sin red de seguridad para migrar |
| 2 | **`backend-health` usa una migración baseline** | Los cambios futuros quedan versionados y auditables |
| 3 | Dos DBs sin FK ni transacciones distribuidas | Consistencia solo por aplicación |
| 4 | `JWT_SECRET` tiene fallback hardcodeado en el código | Riesgo si falta el env |
| 5 | Sin observabilidad (solo `console.log`) | Diagnóstico difícil |
| 6 | CI base en GitHub Actions, todavía sin tests | Falta completar la Fase 3 |
| 7 | CORS restringido a `FRONTEND_URL`; rate limit en auth | Pendiente validar en un entorno desplegado |
| 8 | `backend-core` compilaba `dist/` dentro del repo | Ya destrackeado y agregado a `.gitignore` |

### 🔜 Próximos pasos
1. Documentar arquitectura en profundidad (arqueología de código).
2. Suite de caracterización sobre la API actual (congelar comportamiento).
3. Tests de contrato entre los 3 servicios.
4. Migraciones reales para `backend-health`.
5. CI/CD + coverage ratchet.
