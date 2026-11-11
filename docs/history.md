# History

> Ancla: `git log` en `main`.
> Confianza: **Medido** (comandos ejecutados el 2026-11-11).

## Línea de tiempo

| Dato | Valor |
|---|---|
| Primer commit | 2026-03-03 00:39 — `Initial commit` |
| Último commit | 2026-03-12 13:41 — merge de `fix/onboardingEspero` |
| Total de commits en `main` | 43 |
| Autores | 1 (`Facuud2`) |
| Período activo | **10 días** (3 al 12 de marzo de 2026) |
| Inactividad al documentar | ~8 meses |

Todo el proyecto —frontend, dos backends, integraciones y docker— se escribió en 10 días.

## Ramas

`main` más seis ramas remotas, todas de feature o fix, ninguna con trabajo posterior al merge:

- `feat/primerMicroservicio`
- `feat/noMeAcuerdoXd`
- `devops/ajustesNpm`
- `fix/nuevosCambiosEnDB`
- `fix/onboardingEspero`
- `logrosdeverdadverdad`

## Lectura del historial

**2026-03-03 — Núcleo.** Next.js inicial, endpoints de login y registro, sistema de tareas (metas diarias), onboarding y primer perfil con gráfico de peso. El backend se refactoriza el mismo día.

**2026-03-04 a 03-06 — Temas y perfil.** Rediseño de `/settings`, sistema de temas nuevos y su transición visual. El perfil completo se termina el 03-04 ("por fin").

**2026-03-07 — Nutrición.** Se agrega la sección de comidas y calorías, la API de FatSecret con datos de prueba, y la estructura inicial de lo que será el microservicio.

**2026-03-08 — Microservicio y Docker.** Nace `backend-health` como microservicio, junto con el primer `docker-compose`.

**2026-03-09 — Actividades dinámicas.** Funcionalidad de actividades (misiones) y fixes del dashboard.

**2026-03-11 — Integraciones y nube.** Se conectan Strava y FatSecret y se hace la primera subida a la nube.

**2026-03-12 — Cierre.** Retos, detalles de planes y corrección del onboarding. Último día de actividad.

## Inferencias (marcadas como tales)

- El `package.json` del frontend se llama `ai-studio-applet` y depende de `@google/genai`: el frontend **probablemente** se originó como applet de Google AI Studio y luego se adaptó. Inferido del nombre y la dependencia, no del historial.
- El commit `feat/noMeAcuerdoXd` ("no me acuerdo") sugiere trabajo hecho sin un plan registrado, consistente con la ausencia total de documentación y tests.
- Los mensajes de commit son informales y no referencian issues; no hay trazabilidad de requerimientos.

## Qué no hay

- Ningún commit de tests.
- Ningún commit de CI.
- Ningún commit posterior a la migración de esquema que agregue las tablas `SideQuestTemplate` y `Achievement`: la funcionalidad se agregó al esquema sin migración.
