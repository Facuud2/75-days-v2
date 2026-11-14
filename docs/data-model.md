# Data Model

> Ancla: `apps/backend-core/prisma/schema.prisma` y `apps/backend-health/prisma/schema.prisma`.
> Confianza: **Leído** + **Medido** (consultas SQL contra ambas bases el 2026-11-11).

## Dos bases, sin integridad cruzada

| Base | Dueño | Tablas |
|---|---|---|
| `75days` | `backend-core` | `User`, `Challenge`, `GoalTemplate`, `DailyLog`, `DailyGoal`, `SideQuest`, `SideQuestTemplate`, `Achievement` |
| `75days_health` | `backend-health` | `UserHealthProfile`, `MealEntry`, `WorkoutEntry`, `Ingredient`, `CustomFood`, `CustomFoodIngredient` |

La única relación entre ambas es el campo `userId`, guardado como texto en `UserHealthProfile`, `MealEntry`, `WorkoutEntry` y `CustomFood`. **No hay foreign key, ni cascade, ni validación de existencia.** Borrar un usuario en core deja sus datos de salud huérfanos, y crear datos de salud con un `userId` inventado funciona si se tiene un JWT válido con ese id (imposible en la práctica, pero el modelo no lo impide).

## Identidad y reto (core)

`User` guarda credenciales (hash bcrypt), datos físicos opcionales y el flag de onboarding completado.

`Challenge` es el reto. Un usuario puede tener varios, con un solo `isActive` a la vez por convención de aplicación (no hay constraint que lo garantice). Guarda dificultad, fecha de inicio, día actual, racha, puntos, mejor peso y cantidad de retos completados.

**Rareza**: `challengesCompleted` nunca se incrementa en ningún controlador. Siempre vale 0, y de ahí sale el logro "Disciplina".

`GoalTemplate` es la plantilla de metas del reto; `DailyLog` es un día concreto y `DailyGoal` una meta de ese día. Al crear el reto y al crear cada día, las plantillas se **copian** a metas concretas. No hay referencia desde `DailyGoal` a `GoalTemplate`: si se edita la plantilla, los días ya creados no cambian.

`DailyLog` tiene unicidad por `(challengeId, date)`, lo que impide dos registros del mismo día para el mismo reto.

**Rareza**: `date` es `String`, no `Date`. El formato `YYYY-MM-DD` se asume en todos lados; ordenar por string funciona porque el formato es ISO, pero no hay validación de formato en el endpoint que recibe la fecha.

`status` de `DailyLog` es `String` con valores `pending` / `success` / `fail` / `rest`. `rest` está declarado en un comentario del esquema y **nunca se escribe** en el código: no hay lógica de día de descanso.

`SideQuest` tiene progreso incremental y un flag `completed`; `SideQuestTemplate` es el catálogo. Una misión personalizada guarda su descripción/icono directamente en `SideQuest` y copia sus tareas a la primera `SideQuestRun`, por lo que queda aislada del catálogo y de otros usuarios. `Achievement` guarda progreso y desbloqueo por usuario, con unicidad por `(userId, title)`.

## Salud (health)

`UserHealthProfile` es uno por usuario (`userId` único) y se crea perezosamente en el primer `PUT` de metas o en el flujo de Strava. Guarda metas de calorías y macros, peso y altura para la estimación, y los tokens de Strava.

`MealEntry` y `WorkoutEntry` son registros planos por usuario y fecha, con índice `(userId, date)`. `WorkoutEntry` tiene `source` (`manual` / `strava`) y `externalId` único global, usado para deduplicar la sincronización.

**Rareza**: `externalId` es único **global**, no por usuario. Si la misma cuenta de Strava se conectara a dos usuarios de la app, el segundo no podría importar las actividades del primero. No es un escenario previsto, pero el constraint lo impide.

`Ingredient` es un catálogo global (no por usuario) con macros por 100 g y nombre único. `CustomFood` es una receta por usuario con macros derivados. `CustomFoodIngredient` es la tabla pivote con gramos por ingrediente, con borrado en cascada desde `CustomFood`.

**Rareza**: los macros de `CustomFood` se calculan una sola vez al crear o editar. Si después cambian los macros de un `Ingredient` (por ejemplo, un re-import de FatSecret), las recetas existentes quedan con valores viejos.

## Deriva de esquema (histórico, resuelta el 2026-11-11)

Hasta el 2026-11-11, las tablas `SideQuestTemplate` y `Achievement` estaban en el esquema pero **no en la base**, porque no existía una migración que las creara. `prisma migrate status` informaba "Database schema is up to date" porque solo compara migraciones aplicadas contra archivos, no el esquema contra la base.

Consecuencia medida en ese momento: `GET /api/quests/available` y `GET /api/users/profile` respondían **500** (`PrismaClientKnownRequestError`, código P2021).

**Resuelto** con la migración `20261111031957_add_side_quest_template_and_achievement`, que crea ambas tablas, sus índices únicos y la FK a `User`. Verificado: ambos endpoints responden 200 y el catálogo de misiones tiene 3 plantillas.

`backend-health` tiene ahora la migración baseline `20261111040000_init`; los cambios futuros deben generarse y aplicarse con `prisma migrate deploy`. En una base existente hay que marcar la baseline como aplicada tras comprobar que el esquema coincide.

## Estado de las bases (2026-11-11, tras F-07 y F-10)

| Tabla | Filas |
|---|---|
| `User` / `Challenge` / `DailyLog` | datos de prueba del recorrido de humo |
| `GoalTemplate` / `DailyGoal` | generados por cada registro |
| `SideQuest` | 0 |
| `SideQuestTemplate` | **3** (seed de core) |
| `Achievement` | se crea al consultar el perfil |
| `Ingredient` | **51** (seed de health) |
| `UserHealthProfile` / `MealEntry` / `WorkoutEntry` / `CustomFood` | 0 salvo los del recorrido de humo |

## Ciclo de vida

- **Usuario**: se crea en el registro con reto y primer día, en una transacción. No hay borrado de usuario.
- **Reto**: se crea al registrarse o al iniciar uno nuevo (desactiva los anteriores). Se archiva o se borra al abandonar, según la antigüedad.
- **Día**: se crea al iniciar el reto y luego cuando el cliente llama a `check-reset`. No hay creación server-side programada.
- **Logro**: se crea o actualiza en cada `GET /users/profile`.
- **Perfil de salud**: se crea en el primer `PUT` de metas o en el callback de Strava.
