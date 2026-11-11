# 75 Days Challenge — Documentación del sistema

Reconstruida el **2026-11-11** leyendo el código en `HEAD` (`734dad9`). No existía documentación previa.

## Cómo leer este árbol

Cada documento declara su nivel de confianza:

| Nivel | Significado |
|---|---|
| **Medido** | Verificado ejecutando el sistema (respuesta HTTP, consulta SQL, log) |
| **Leído** | Verificado leyendo el código en HEAD |
| **Inferido** | Deducido del código o del historial, sin prueba directa |

## Índice

| Documento | Qué contiene |
|---|---|
| [overview.md](overview.md) | Límites del sistema, mapa de dependencias real, topología |
| [backend-core.md](backend-core.md) | Servicio de usuarios, retos, metas diarias y misiones |
| [backend-health.md](backend-health.md) | Microservicio de nutrición, entrenamientos y estadísticas |
| [frontend.md](frontend.md) | App Next.js: páginas, estado, flujos |
| [api-reference.md](api-reference.md) | Todos los endpoints, con auth, body y respuesta |
| [data-model.md](data-model.md) | Qué se guarda, quién lo posee, ciclo de vida y rarezas |
| [config-reference.md](config-reference.md) | Cada variable de entorno y quién la lee |
| [integrations.md](integrations.md) | FatSecret, Strava y el canal interno; Gemini fue eliminado |
| [processes.md](processes.md) | Procesos de negocio end-to-end |
| [history.md](history.md) | Qué muestra `git log` |
| [findings.md](findings.md) | Defectos sospechados, con `archivo:línea` |
| [coverage.md](coverage.md) | Cobertura de esta documentación |
| [unknowns.md](unknowns.md) | Lo que no se pudo determinar |
| [PLAN.md](PLAN.md) | Plan completo de recuperación (fases 2–6) |
| [production-release.md](production-release.md) | Publicación, Render, secretos, bases limpias, smoke test y rollback |
| [adr/](adr/) | Decisiones de arquitectura reconstruidas |
| [../GLOSSARY.md](../GLOSSARY.md) | Glosario del dominio |

## Estado en una línea

Los tres servicios arrancan y el camino feliz de registro, misiones, logros y alimentos personalizados está operativo. La guía de producción y el laboratorio local de edge cases están documentados en `production-release.md` y `/dev/edge-cases`.
