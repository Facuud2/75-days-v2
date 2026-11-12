# QA Project Context — 75 Days Challenge

> Generado el 2026-11-11 por arqueología de código. Fuente de verdad para las skills de QA.
> Valores detectados citados con su archivo; lo no verificable figura como **Desconocido**.

## Product

Aplicación de retos personales de 75 días: el usuario elige una dificultad, cumple metas diarias, y registra nutrición y entrenamiento.

**Tipo**: aplicación web de consumo (SaaS de un solo usuario por cuenta).

**Journeys críticos** (si falla, la app no sirve):

1. Registro → creación automática de reto y primer día.
2. Login → restauración de sesión con JWT.
3. Onboarding → completar edad, peso, altura y peso objetivo.
4. Dashboard → ver día actual, metas y racha.
5. Marcar metas del día → actualización de puntos y racha.
6. `check-reset` → cierre del día anterior y creación del día actual.
7. Registrar comida → totales de calorías y macros.
8. Registrar entrenamiento → estimación de calorías.
9. Ver perfil → estadísticas, historial de peso y logros.
10. Abandonar o iniciar un reto nuevo.

**URLs**: desarrollo `http://localhost:3000` (frontend), `:3001` (core), `:3002` (health).
Producción/staging: **Desconocido** — no hay configuración de despliegue versionada. El historial menciona una subida a la nube el 2026-03-11.

## Tech Stack

Monorepo sin workspace manager (`turbo.json`/`pnpm-workspace.yaml`/`nx.json` ausentes); cada app tiene su propio `package.json` y `node_modules`.

### `apps/frontend`
- Next.js 15.5.12 (App Router) · React 19 · TypeScript 5.9.3
- Tailwind CSS 4 · Zustand 5 · react-hook-form 7 · Zod 4 · Recharts 3 · Motion 12
- `@google/genai` 1.x
- Fuente: `apps/frontend/package.json`, `apps/frontend/next.config.ts`

### `apps/backend-core`
- Node.js · Express 5.2 · TypeScript 5.9.3 · ts-node
- Prisma 6.19.2 · PostgreSQL 16
- Zod 4 · jsonwebtoken 9 · bcryptjs 3
- Fuente: `apps/backend-core/package.json`

### `apps/backend-health`
- Node.js · Express **4.22** (distinto de core) · TypeScript 5.9.3 · nodemon
- Prisma 6.19.2 · PostgreSQL 16 · axios 1.13
- Fuente: `apps/backend-health/package.json`

### Infraestructura
- Dos bases PostgreSQL 16 independientes (`75days`, `75days_health`)
- Docker Compose para desarrollo; `node:22` como imagen base
- Hosting de producción: **Desconocido**
- Observabilidad: ninguna (solo `console.log`)

## Test Stack

### E2E / Integration
- **Framework**: None selected yet — Playwright recomendado (`playwright-automation`).
- Config: no existe.

### Unit / Component
- **Framework**: None selected yet — Vitest recomendado (`unit-testing`).
- Config: no existe.

### API
- **Framework**: None. `npm test` en `backend-core` devuelve `Error: no test specified`; `backend-health` no tiene script `test`.
- **Ejecución observada**: ninguna. No hay tests en el repositorio.

### Cobertura
- Ninguna medida. No hay Istanbul/V8 configurado.

## CI/CD

- **Plataforma**: GitHub Actions (`.github/workflows/ci.yml`).
- **Cuándo corren los tests**: todavía no hay tests; el pipeline ejecuta lint, typecheck, Prisma validate y build en cada PR/push a `main`.
- **Qué bloquea un deploy**: el pipeline bloquea cambios con errores de lint, typecheck, validación Prisma o build; falta incorporar el gate de tests.
- **Artefactos**: ninguno todavía.

## Environments

| Entorno | Existe | Notas |
|---|---|---|
| Desarrollo | Sí | Docker Compose + bases locales; integraciones externas opcionales (vacías) |
| Staging | No | — |
| Producción | Desconocido | Referencia a NeonDB en `apps/backend-core/README.md`; sin configuración |

**Paridad**: en desarrollo, FatSecret y Strava están deshabilitados por falta de credenciales. Un flujo verde en local puede fallar en producción y viceversa. Gemini también está deshabilitado.

## Quality Goals

**Acordados**: ninguno.

**Propuestos** (madurez: proyecto temprano, un solo desarrollador, 8 meses inactivo):

| Métrica | Objetivo propuesto |
|---|---|
| Cobertura de líneas en controladores | 70 % |
| Cobertura de `calorieCalculator` | 100 % |
| E2E de journeys críticos | top 5 (registro, login, marcar metas, comida, entrenamiento) |
| Flakiness | < 2 % en ventana de 30 días |
| Duración de suite unitaria | < 3 min |
| Duración de E2E | < 15 min |

Estos números son propuestas, no compromisos. Ver `docs/PLAN.md` Fase 3.

## Risk Areas

| Área | Nivel | Impacto de negocio | Notas |
|---|---|---|---|
| Cierre de día y racha (`check-reset`) | **Crítico** | Alto impacto + alta probabilidad | Depende del cliente; lógica de fechas y zona horaria. Evidencia: `docs/findings.md` F-04 |
| Deriva de esquema | **Crítico** | Alto impacto + probabilidad demostrada | Ya ocurrió: dos tablas ausentes, endpoints en 500 (F-07) |
| Autenticación JWT compartida | Importante | Alto impacto, baja frecuencia de cambio | Secreto con fallback hardcodeado (F-12); sin revocación |
| Nutrición y macros | Importante | Alto impacto, cálculo con muchas ramas | Catálogo vacío (F-10); estimación MET (F-09) |
| Integraciones externas (FatSecret, Strava) | Importante | Alto impacto, alta volatilidad | Sin credenciales en desarrollo; tokens en claro (F-15) |
| Migraciones de health | Importante | Alto impacto | `db push` sin historial (F-21) |
| Perfil y logros | Monitor | Impacto medio, alta probabilidad de fallo | Escritura en lectura, O(historial) (F-05) |
| Frontend / UI | Monitor | Impacto medio | Sin tests de navegador |

**Desconocido**: historial real de incidentes en producción. No hay evidencia disponible.

## Team

- **Desarrolladores**: 1 (`Facuud2`, único autor de los 43 commits).
- **QA**: 0.
- **Ratio**: infinito (solo/dev).
- **Metodología**: **Desconocido**; el historial sugiere trabajo ad-hoc (mensajes como "no me acuerdo").
- **Modelo de ownership**: el desarrollador es dueño de todos los tests. Automatización de bajo costo (Playwright + Vitest) y gates de CI, sin suite manual de regresión.

## Conventions

- **Naming de archivos**: `camelCase.ts` en backends; `PascalCase.tsx` en componentes del frontend; páginas en `app/<ruta>/page.tsx`.
- **Estructura**: backends por capas (`routes` → `controllers` → `utils/lib`); frontend por `app`, `components`, `store`, `lib/api`.
- **Branching**: `main` protegida por PRs; ramas `feat/*`, `fix/*`, `devops/*`. Merges vía Pull Request (5 PRs en el historial).
- **Selectores E2E**: no definidos. Default recomendado: `data-testid` en kebab-case.
- **Datos de test**: no hay factories ni fixtures. Recomendado: bases efímeras con Testcontainers + seeds deterministas.
- **Estilo de errores**: inconsistente. Core devuelve `{ error, details }`; health devuelve `{ error: flatten }` o `{ error: string }`.
- **Documentación**: `docs/` (arquitectura, API, modelo, plan) + `GLOSSARY.md` + `docs/adr/`.

## Provenance

| Sección | Fuente |
|---|---|
| Product | `docs/overview.md`, `docs/processes.md` |
| Tech Stack | `package.json` × 3, `next.config.ts`, `docker-compose.yml` |
| Test Stack | ausencia verificada de configs y scripts |
| CI/CD | ausencia verificada de workflows |
| Environments | `docker-compose.yml`, `.env.example` × 3 |
| Quality Goals | propuesta, no acordada |
| Risk Areas | `docs/findings.md` |
| Team | `git shortlog -sn` |
| Conventions | lectura de `src/` y `git log` |
