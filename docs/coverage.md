# Coverage Ledger

> Fecha de la campaña: **2026-11-11**. Commit base: `734dad9`.
> Regla: un documento cuenta como **revisado** solo tras una segunda lectura. Todos los de esta campaña están **borrador**.

## Denominadores (inventario medido)

| Superficie | Total | Comando |
|---|---|---|
| Endpoints HTTP | **44** | `grep -rhoE "router\.(get\|post\|patch\|put\|delete)" apps/*/src/routes \| wc -l` |
| Tablas en esquemas | **14** (8 core + 6 health) | `grep -c "^model " apps/*/prisma/schema.prisma` |
| Variables de entorno | **16** (12 backends + 4 frontend) | `grep -rhoE "process\.env\.[A-Z_0-9]+\|NEXT_PUBLIC_[A-Z_0-9]+" apps --include="*.ts" \| sort -u` |
| Integraciones externas | **2** (FatSecret, Strava) + canal interno + 2 bases | lectura de `lib/` y controladores; Gemini eliminado |
| Páginas del frontend | **8** (7 en `app/` + raíz) | `ls apps/frontend/app` |
| Servicios desplegables | **3** | `docker-compose.yml` |

## Estado por documento

| Documento | Cobertura | Estado |
|---|---|---|
| `docs/README.md` | índice | borrador |
| `docs/overview.md` | topología, límites, auth, persistencia | borrador |
| `docs/backend-core.md` | 17/17 endpoints, 8/8 tablas, reglas de negocio | borrador |
| `docs/backend-health.md` | 27/27 endpoints, 6/6 tablas, integraciones | borrador |
| `docs/frontend.md` | 8/8 páginas, 5 stores, capa API | borrador |
| `docs/api-reference.md` | 44/44 endpoints | borrador |
| `docs/data-model.md` | 14/14 tablas, deriva medida | borrador |
| `docs/config-reference.md` | 16/16 variables, knobs muertos marcados | borrador |
| `docs/integrations.md` | 3/3 externas + canal interno | borrador |
| `docs/processes.md` | 6 flujos end-to-end | borrador |
| `docs/history.md` | 43/43 commits | borrador |
| `docs/findings.md` | 47 hallazgos con evidencia | borrador |
| `docs/unknowns.md` | 6 incógnitas | borrador |
| `docs/PLAN.md` | 8 fases | borrador |
| `GLOSSARY.md` | 22 términos | borrador |
| `docs/adr/` | 6 ADRs | borrador |

## Evidencia de runtime usada

| Qué | Cómo | Fecha |
|---|---|---|
| Servicios arriba | `curl` a `:3000`, `:3001/health`, `:3002/health` → 200 | 2026-11-11 |
| Registro + JWT + reto | `POST /api/auth/register` → 201 con token | 2026-11-11 |
| JWT interoperable | mismo token aceptado en `:3002` | 2026-11-11 |
| Guards | 401 sin token; 403 con API key inválida | 2026-11-11 |
| Deriva de esquema | `\dt` + P2021 en log | 2026-11-11 |
| Ingredientes vacíos | `GET /ingredients` → `[]` | 2026-11-11 |
| Secreto JWT efectivo | verificación con `jsonwebtoken` contra ambos secretos | 2026-11-11 |
| Filas por tabla | `count(*)` en las 12 tablas existentes | 2026-11-11 |
| F-07 resuelto | migración `20261111031957`; `/quests/available` y `/users/profile` → 200 | 2026-11-11 |
| F-10 resuelto | seed de 51 ingredientes; `POST /nutrition/custom-foods` → 201 | 2026-11-11 |
| F-01 resuelto | `register` con `Custom` sin metas → 400; con una meta → 201 | 2026-11-11 |
| F-03 resuelto | 20 rondas × 8 operaciones concurrentes: invariante intacto, 0 respuestas 500 | 2026-11-11 |

## Pendiente de esta campaña

- Revisión por segundo lector de todos los documentos.
- Diagramas de proceso en `docs/diagrams/` (los flujos están en prosa en `processes.md`).
- Verificación de los endpoints de Strava y FatSecret con credenciales reales: no fue posible sin ellas.
