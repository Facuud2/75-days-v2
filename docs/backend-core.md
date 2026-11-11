# backend-core

> Ancla: `apps/backend-core/src`.
> Confianza: **Leído**; los puntos marcados **Medido** se verificaron contra el servicio corriendo.

## Rol

Es el servicio de identidad y de progreso del reto. Registra usuarios, crea y archiva retos, mantiene el registro diario de metas, calcula racha y puntos, y administra misiones secundarias y logros.

## Entrada

Un único proceso Express 5 en el puerto 3001. Monta cinco routers bajo `/api` y un `GET /health` sin autenticación. El middleware de autenticación se aplica por router completo en retos, logs, misiones y perfil; en auth se aplica endpoint por endpoint porque registro y login son públicos.

## Registro

El alta de usuario es una transacción: crea el usuario, un reto activo con la dificultad elegida, las plantillas de metas de ese reto y el primer registro diario ya poblado con esas metas. Si cualquiera de esas escrituras falla, no queda usuario huérfano.

La contraseña se guarda con bcrypt (costo 10) y la respuesta incluye un JWT de 7 días junto con el usuario y el reto recién creado, de modo que el frontend no necesita una segunda llamada para pintar el primer día.

### Validación de `Custom` (resuelta)

Tanto el registro como el inicio de reto rechazan un reto `Custom` sin metas con **400**. Antes, el registro aceptaba `difficulty: "Custom"` sin `customGoalsTemplate` y reventaba con 500 al indexar `DEFAULT_GOALS['Custom']` (que no existe). Ver `findings.md` F-01 (resuelto el 2026-11-11).

### Duplicación de las metas por defecto

El catálogo de metas por dificultad está escrito dos veces, con contenidos distintos: una copia en el controlador de autenticación y otra en el de retos. Un usuario que se registra con dificultad `Soft` recibe un conjunto de metas; uno que inicia un reto nuevo con la misma dificultad recibe otro. Ver `findings.md` F-02.

## Progreso diario

### Regla de puntos y racha

Marcar la última meta pendiente de un día pone ese día en `success`, suma 10 puntos y suma 1 a la racha. Desmarcar una meta de un día que estaba en `success` lo devuelve a `pending` y resta 10 puntos y 1 de racha, con piso en cero.

La operación es **atómica por día**: `updateGoalStatus` corre dentro de una transacción y toma un `pg_advisory_xact_lock(hashtext(dailyLogId))` antes de leer el estado. Las peticiones concurrentes sobre el mismo día se serializan y esperan turno en vez de pisarse; las de días distintos no se bloquean entre sí. El lock se libera al hacer commit. Ver `findings.md` F-03 (resuelto el 2026-11-11).

Invariante verificado: `status = success` ⇔ todas las metas del día están completas; `points = 10` y `streak = 1` si el día está completo, `0/0` si no.

### El cambio de día lo dispara el cliente

No hay cron ni job programado. El frontend llama a `check-reset` al cargar la app; ese endpoint es el que:

- calcula el número de día del reto a partir de la fecha de inicio y la fecha local del navegador,
- cierra el día anterior como `fail` si quedó `pending`,
- pone la racha en cero si el día anterior no fue exitoso,
- crea el registro del día actual copiando las plantillas del reto,
- devuelve todos los registros del reto.

Consecuencia: **si el usuario no abre la aplicación, el día no se cierra y la racha no se rompe**. El estado del reto depende de que el cliente se conecte. Ver `findings.md` F-04.

El cálculo de fecha usa el desfase de zona horaria que envía el navegador; es la única noción de "hoy local" del sistema, y no está validada.

### Métricas del día

Peso, URL de foto y notas se actualizan sobre el registro de esa fecha. Al registrar un peso menor que el mejor histórico del reto, se actualiza el mejor peso del reto. Los valores son opcionales y se aplican en bloque; no se distingue "no enviado" de "enviado vacío" más allá de la validación de tipo.

## Abandono del reto

Si el reto activo tiene menos de 24 horas, abandonarlo **lo borra** junto con sus metas y registros. Si tiene más, solo se marca inactivo y se conserva el historial. La comparación es en horas absolutas, así que el reloj del servidor define el corte.

Al iniciar un reto nuevo se desactivan todos los activos previos; un usuario puede acumular retos inactivos sin límite.

## Perfil y logros

`GET /users/profile` es el endpoint más costoso y el más sorprendente: además de leer, **escribe**. En cada llamada:

1. Recorre todos los retos del usuario y todos sus registros para calcular días exitosos, mejor racha, peso inicial, peso actual y pérdida de peso.
2. Evalúa seis definiciones de logro codificadas en el controlador (primer día, racha de 7, reto de 75 días, 10 pesajes, primera misión, 5 kg perdidos).
3. Hace *upsert* manual de cada logro: actualiza si cambió el progreso, crea si no existía.

Consecuencia: el listado de logros no es un dato almacenado que evoluciona por eventos, sino el resultado de recalcular todo el historial en cada visita al perfil. El costo crece con el historial y una lectura puede fallar por escritura. Ver `findings.md` F-05.

El "peso actual" que devuelve es en realidad el **mejor peso registrado**, no el último. Ver `findings.md` F-06.

## Misiones secundarias

Hay un catálogo de plantillas (tres misiones sembradas por el seed: detox de azúcar, 8K pasos, ayuno 12/12) y misiones por usuario con progreso incremental de un día por llamada. Completar una misión no otorga puntos: el campo de puntos del reto no se toca en ese flujo.

El endpoint de catálogo deja un `console.log` de depuración en cada llamada.

## Estado actual

**Medido**: registro, login, `/auth/me`, `/challenges/current`, marcado de metas y `check-reset` responden correctamente. `GET /quests/available` devuelve las 3 plantillas del seed y `GET /users/profile` responde 200: las tablas `SideQuestTemplate` y `Achievement` se crearon con la migración `20261111031957` el 2026-11-11 (F-07 resuelto). Ver `data-model.md`.
