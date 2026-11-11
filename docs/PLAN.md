# PLAN — Recuperación y continuación del proyecto

> Documento vivo. Creado el **2026-11-11** al cerrar la Fase 1 (arqueología).
> Si retomás el proyecto en el futuro: leé esto primero, después `docs/README.md`.
> Estado: **Fase 1 completa**. Fases 2 en adelante pendientes.

---

## 0. Punto de partida

El proyecto estaba parado desde el **2026-03-12** (8 meses), sin documentación, sin tests y con dos funcionalidades rotas en producción local.

Al cerrar la Fase 1 el sistema:

- Arranca de forma reproducible (`docker compose up` o local).
- Tiene documentación de arquitectura, API, modelo de datos, configuración e integraciones.
- Tiene identificados **47 hallazgos** con ubicación (`docs/findings.md`).
- **Sigue roto** en misiones secundarias, logros y alimentos personalizados.

### Bloqueantes conocidos

| ID | Problema | Efecto |
|---|---|---|
| F-07 | Tablas `SideQuestTemplate` y `Achievement` ausentes | **Resuelto 2026-11-11** (migración `20261111031957`) |
| F-10 | Catálogo de ingredientes vacío | **Resuelto 2026-11-11** (51 ingredientes) |
| F-20 | Cero tests | Cualquier cambio es a ciegas |
| F-21 | `backend-health` sin migraciones | Cambios de esquema sin historial ni rollback |

---

## 1. Principios de trabajo

1. **Caracterización antes de cambio.** Primero se congela el comportamiento actual con tests; después se modifica. No se "arregla" nada que no esté cubierto.
2. **Un cambio, un commit, un check.** Nada de ramas gigantes.
3. **La documentación se actualiza en el mismo PR que el cambio de comportamiento.** Si no, vuelve a podrirse.
4. **Nada de refactors estéticos antes de la Fase 6.** El objetivo es estabilidad, no belleza.
5. **Cada fase termina con criterio de aceptación verificable**, no con "quedó andando".

---

## 2. Fase 2 — Reparar bloqueantes y cerrar la deriva

**Objetivo**: que las funcionalidades existentes funcionen y que el esquema y la base vuelvan a coincidir.

### Tareas

- [x] **2.1 — Generar la migración faltante de core.** *(hecho 2026-11-11)*
  `npx prisma migrate dev --name add_side_quest_template_and_achievement`
  Migración `20261111031957`: crea `SideQuestTemplate`, `Achievement`, sus índices únicos y la FK a `User`.
  *Aceptación cumplida*: `\dt` muestra las 8 tablas; `GET /quests/available` → 200; `GET /users/profile` → 200.

- [x] **2.2 — Detectar y cerrar cualquier otra deriva.** *(hecho 2026-11-11)*
  `npx prisma migrate diff --from-schema-datasource --to-schema-datamodel` sobre core y health. Si hay diferencias, generar migración.
  *Aceptación cumplida*: diff vacío en core (\"This is an empty migration\"). Health sigue con `db push` hasta la tarea 2.3.

- [ ] **2.3 — Convertir `backend-health` a migraciones versionadas.**
  Baseline: `npx prisma migrate diff --from-empty --to-schema-datamodel --script > prisma/migrations/0001_init/migration.sql`, marcar como aplicada con `prisma migrate resolve --applied`, y desde ahí usar solo `migrate deploy`.
  *Aceptación*: `prisma/migrations/` existe en health; el compose usa `migrate deploy` en ambos.

- [x] **2.4 — Sembrar ingredientes base.** *(hecho 2026-11-11)*
  Catálogo de **51 alimentos comunes** con macros por 100 g en `backend-health/prisma/seed.ts`. Seed idempotente (upsert por nombre). Script `npm run db:seed` en ambos backends, ejecutado en el arranque del compose.
  *Aceptación cumplida*: `GET .../ingredients` devuelve 51; se creó un alimento personalizado de punta a punta (201 con macros calculados).

- [ ] **2.5 — Documentar la decisión de `challengesCompleted`.**
  El campo nunca se incrementa y el logro "Disciplina" es inalcanzable. Decidir: implementar el incremento al llegar al día 75, o eliminar el logro. Registrar la decisión en un ADR.

- [x] **2.6 — Corregir F-01 (registro con `Custom` sin metas).** *(hecho 2026-11-11)*
  `register` devuelve **400** si `difficulty: "Custom"` llega sin `customGoalsTemplate` o con array vacío, igual que `startChallenge`.
  *Aceptación cumplida*: sin plantilla → 400; array vacío → 400; con una meta → 201.

- [x] **2.6b — Corregir F-03 (puntos y racha no atómicos).** *(hecho 2026-11-11)*
  `updateGoalStatus` corre en una transacción y toma un `pg_advisory_xact_lock` sobre el `dailyLogId` antes de leer y escribir. Serializa solo las escrituras del mismo día; el lock se libera al commit.
  *Aceptación cumplida*: 3 rondas de 4 marcas concurrentes → todas 200 y estado consistente; 20 rondas de 8 operaciones mixtas → invariante intacto, 0 respuestas 500. Borde: meta ajena → 404, fecha incorrecta → 404, body inválido → 400.

- [ ] **2.7 — Unificar las metas por defecto (F-02).**
  Extraer el catálogo a un único módulo compartido y hacer que registro y `start` usen la misma fuente. Verificar cuál de las dos versiones es la correcta **antes** de unificar (requiere decisión del dueño).

- [ ] **2.8 — Sanear la configuración.**
  Eliminar knobs muertos (`FRONTEND_URL` en core, `NODE_ENV` en health, `APP_URL` en frontend). Quitar el fallback hardcodeado de `JWT_SECRET` (F-12): fallar al arrancar si falta. Cargar la configuración en un módulo que se importe primero (F-11).

- [ ] **2.9 — Persistir el ancla del reto (F-36).**
  Incluir `startDate` y `difficulty` en el `partialize` de `challenge-storage`, o dejar de persistir el reto y pedirlo siempre al backend. Verificar que `/calendar` y el dashboard funcionen tras un reload con storage limpio.
  *Aceptación*: recargar en `/dashboard` no muestra plan `HARD` por defecto ni "No Active Challenge" en `/calendar`.

- [ ] **2.10 — Unificar los dos sistemas de misiones (F-42).**
  Eliminar `sideQuests` de `useChallengeStore` o hacer que onboarding escriba en `useQuestStore`. Hoy las misiones elegidas en el onboarding no aparecen en el dashboard.
  *Aceptación*: una misión adoptada en el onboarding se ve en el dashboard sin recargar.

- [ ] **2.11 — Corregir los bugs visibles del frontend.**
  F-38 (`@custom-variant dark`), F-39 (no loguear la contraseña), F-40 (`walking` rechazado), F-41 (UTC vs local), F-45 (dashboard en blanco), F-46 (`logs` undefined), F-44 (`tw-animate-css`), F-37 (logout no limpia el reto). Son cambios pequeños y de alto impacto percibido.
  *Aceptación*: el toggle de tema afecta a toda la UI; guardar una caminata devuelve 201; el dashboard carga con storage limpio.

**Criterio de aceptación de la fase**: los 44 endpoints responden sin 500 en un recorrido de humo; el esquema de ambas bases coincide con sus `schema.prisma`; no quedan secretos con fallback.

**Riesgo**: 2.3 y 2.1 tocan esquema. Hacer backup antes (`pg_dump` de ambas bases) y probar sobre una copia.

---

## 3. Fase 3 — Red de seguridad: tests de caracterización

**Objetivo**: congelar el comportamiento actual antes de tocar lógica de negocio. Estos tests no dicen "esto está bien"; dicen "esto es lo que hace hoy".

### Tareas

- [ ] **3.1 — Infraestructura de tests.**
  Vitest + Supertest para los backends; `@testcontainers/postgresql` para bases efímeras. Script `test` real en ambos `package.json` (hoy devuelve `exit 1`).
  *Aceptación*: `npm test` corre y falla si se rompe un endpoint.

- [ ] **3.2 — Tests de caracterización de `backend-core` (17 endpoints).**
  Un archivo por router. Para cada endpoint: caso feliz, caso sin token (401), caso de recurso ajeno (404/403), caso de validación (400). Guardar las respuestas actuales como referencia.
  *Aceptación*: cobertura de líneas ≥ 70 % en `controllers/`.

- [ ] **3.3 — Tests de caracterización de `backend-health` (27 endpoints).**
  Igual, con foco en: cálculo de macros, estimación de calorías, agregaciones de stats, y los `403` de propiedad.
  *Aceptación*: cobertura ≥ 70 % en `controllers/` y 100 % en `utils/calorieCalculator.ts`.

- [ ] **3.4 — Tests de las reglas de negocio del reto.**
  Casos obligatorios: completar todas las metas suma 10 puntos y 1 de racha; desmarcar resta; `check-reset` cierra el día anterior como `fail`; abandono <24 h borra y ≥24 h archiva; el día actual se calcula bien cruzando fin de mes.
  *Aceptación*: cada regla de `docs/backend-core.md` tiene al menos un test que la fija.

- [ ] **3.5 — Documentar los comportamientos "raros" como tests.**
  F-05 (perfil escribe), F-06 (peso actual = mejor peso), F-23 (balance neto vs restante). El test debe nombrar la rareza para que nadie la "arregle" sin decidirlo.

**Criterio de aceptación de la fase**: se puede refactorizar cualquier controlador y saber en segundos si cambió el comportamiento observable.

---

## 4. Fase 4 — Contratos entre servicios

**Objetivo**: que los tres clientes no se rompan entre sí cuando uno cambia.

- [ ] **4.1 — Definir el contrato.** Extraer los tipos de request/response de los 44 endpoints a un paquete `packages/contracts` (Zod schemas) compartido por frontend y backends.
- [ ] **4.2 — Validación en runtime.** Usar esos schemas en los controladores (reemplaza los Zod locales duplicados) y en el cliente del frontend.
- [ ] **4.3 — Tests de contrato.** Pact consumer-driven: frontend → core, frontend → health. Verificar que un cambio de respuesta rompe el build, no la UI en producción.
- [ ] **4.4 — OpenAPI.** Generar `openapi.json` desde los schemas y publicarlo en `docs/api-reference.md` como fuente.

**Aceptación**: el frontend y los backends comparten una única definición de cada payload; un cambio incompatible falla en CI.

---

## 5. Fase 5 — Actualización de dependencias

**Objetivo**: salir de 8 meses de deuda sin romper nada (posible gracias a Fases 3 y 4).

- [ ] **5.1 — Inventario.** `npm outdated` en las tres apps; clasificar por riesgo (patch / minor / major).
- [ ] **5.2 — Automatizar.** Dependabot o Renovate, agrupado por app, con CI obligatorio.
- [ ] **5.3 — Orden de actualización.** Primero parches y minors de tooling (TypeScript, ESLint, ts-node), después runtime (Express 4→5 en health, Prisma, Next), después UI.
- [ ] **5.4 — Express 4 → 5 en health.** Al hacerlo se resuelve F-08 (errores async) de forma nativa. Verificar los cambios de breaking en routing y en `req.query`.
- [ ] **5.5 — Prisma.** Alinear ambas apps a la misma versión; migrar a la versión estable más nueva que soporte el equipo.
- [ ] **5.6 — Node.** Fijar la versión (el compose usa `node:22`, la máquina tiene 26) con `.nvmrc` y `engines`.

**Aceptación**: CI verde con todas las dependencias en su última versión compatible; sin `npm audit` de severidad alta.

---

## 6. Fase 6 — CI/CD y calidad continua

- [ ] **6.1 — Pipeline base (GitHub Actions).** Lint + typecheck + tests + build en cada PR, con Postgres de servicio.
- [ ] **6.2 — Gates.** Cobertura con ratchet (nunca baja), migraciones verificadas, `openapi` sin diff inesperado.
- [ ] **6.3 — Entornos.** Per-PR con base efímera; staging con datos sintéticos.
- [ ] **6.4 — Imágenes.** Dockerfiles multi-stage reales (hoy el compose corre `node:22` con el código montado).
- [ ] **6.5 — Observabilidad.** Reemplazar `console.log` por logs estructurados (pino) con request id; healthchecks reales; métricas básicas.

**Aceptación**: un PR no se mergea si rompe un test, baja cobertura o deja el esquema desalineado.

---

## 7. Fase 7 — Seguridad

Ordenado por riesgo real, no por checklist.

- [ ] **7.1** Quitar el fallback de `JWT_SECRET` y fallar al arrancar (F-12).
- [ ] **7.2** Cerrar CORS a los orígenes conocidos (F-13).
- [ ] **7.3** Rate limiting en login y registro; bloqueo por intentos (F-29).
- [ ] **7.4** Política de contraseñas y hash con costo revisado (F-30).
- [ ] **7.5** Strava: `state` aleatorio de un solo uso; cifrar tokens en reposo; endpoint de desconexión (F-14, F-15).
- [ ] **7.6** Escaneo de dependencias (OSV-Scanner) y SAST (Semgrep) en CI.
- [ ] **7.7** Revisión de autorización: verificar que **todo** endpoint con `:id` compruebe propiedad. Hoy lo hacen los de health; auditar los de core.

**Aceptación**: cero hallazgos críticos/altos abiertos; ningún secreto con default en el código.

---

## 8. Fase 8 — Producto: cerrar lo que quedó a medias

Decisiones de producto pendientes del dueño. Cada una requiere definir el comportamiento esperado **antes** de codificar.

- [ ] **8.1 — Cerrar el día en el servidor (F-04).** Job programado por zona horaria, o cierre perezoso al leer el reto. Elimina la dependencia del cliente.
- [ ] **8.2 — Conectar dieta y entrenamiento al reto.** Activar el canal interno dormido: que el cumplimiento de dieta y de 45 minutos de entrenamiento cuente para el día. Requiere decidir si reemplaza o complementa el marcado manual.
- [ ] **8.3 — Logros.** Implementar `challengesCompleted` (F-18) o retirar el logro; decidir si los logros se calculan al leer o por eventos.
- [ ] **8.4 — Misiones secundarias.** Definir si otorgan puntos; hoy no lo hacen.
- [ ] **8.5 — Día de descanso.** El estado `rest` existe en el esquema y nunca se usa. Decidir si se implementa.
- [ ] **8.6 — Edición de metas.** Hoy las metas de un día son copias inmutables de la plantilla. Decidir si se pueden editar por día.
- [ ] **8.7 — Recuperación de contraseña.** No existe.
- [ ] **8.8 — Borrado de cuenta.** No existe, y dejaría datos huérfanos en health.

---

## 9. Backlog priorizado (vista única)

| Prioridad | Tarea | Fase | Esfuerzo |
|---|---|---|---|
| P0 | Migración faltante (F-07) | 2.1 | S |
| P0 | Seed de ingredientes (F-10) | 2.4 | S |
| P0 | Infra de tests (F-20) | 3.1 | M |
| P0 | Caracterización de API | 3.2–3.4 | L |
| P0 | Persistir `startDate`/`difficulty` (F-36) | 2.9 | S |
| P1 | Unificar los dos stores de misiones (F-42) | 2.10 | M |
| P1 | Bugs visibles del frontend (F-37…F-47) | 2.11 | M |
| P1 | Migraciones en health (F-21) | 2.3 | M |
| P1 | Quitar fallback de JWT (F-12) | 2.8 | S |
| P1 | Unificar metas por defecto (F-02) | 2.7 | S |
| P1 | Validación `Custom` en registro (F-01) | 2.6 | ✅ |
| P1 | Puntos/racha atómicos (F-03) | 2.6b | ✅ |
| P1 | CI base | 6.1 | M |
| P2 | Contratos compartidos | 4.1–4.2 | L |
| P2 | Errores async en health (F-08) | 5.4 | M |
| P2 | CORS + rate limit | 7.2–7.3 | S |
| P2 | Strava seguro (F-14, F-15) | 7.5 | M |
| P3 | Actualización de dependencias | 5 | L |
| P3 | Observabilidad | 6.5 | M |
| P3 | Cierre de día server-side (F-04) | 8.1 | L |

Esfuerzo: S ≤ 2 h · M ≤ 1 día · L > 1 día.

---

## 10. Definición de terminado (por tarea)

Una tarea está terminada cuando:

1. Tiene test que la cubre (o justificación explícita de por qué no).
2. Pasa lint, typecheck y tests en local.
3. Actualiza la documentación de `docs/` si cambió comportamiento.
4. Actualiza `docs/findings.md` (marca el hallazgo como resuelto).
5. Es un commit atómico con mensaje que explica el **por qué**.

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| La migración de 2.1 borra datos | Backup previo; revisar SQL generado; probar en copia |
| `db push` en health destruye datos al migrar a migraciones | Baseline con `migrate diff`, no `migrate dev` |
| Actualizar Next/Prisma rompe el frontend | Fases 3 y 4 primero; una major por PR |
| Volver a abandonar el proyecto | Este documento + `docs/README.md` + ADRs + CI como memoria externa |
| No recordar decisiones de producto | Cada decisión de Fase 8 se registra como ADR antes de implementar |

---

## 12. Decisiones que necesito del dueño

1. **Metas por defecto**: ¿cuál de las dos versiones (`authController` o `challengeController`) es la correcta para cada dificultad?
2. **Cumplimiento de salud**: ¿debe afectar la racha, o es solo informativo?
3. **Logros**: ¿se mantienen? ¿"Disciplina" requiere completar 75 días de verdad?
4. **Misiones**: ¿otorgan puntos?
5. **Día de descanso**: ¿existe el concepto en el producto?
6. **Alcance de la recuperación**: ¿solo dejarlo estable, o también prepararlo para producción?

---

## 13. Comandos de referencia

```bash
# Levantar todo
docker compose up

# Estado de migraciones
cd apps/backend-core && npx prisma migrate status
cd apps/backend-health && npx prisma migrate status   # tras Fase 2.3

# Comparar esquema vs base
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
                        --to-schema-datamodel prisma/schema.prisma

# Backup
docker exec 75days-postgres pg_dump -U dev 75days > core.sql
docker exec 75days-postgres pg_dump -U dev 75days_health > health.sql

# Smoke test de los 44 endpoints
# (crear en Fase 3.1 como script reutilizable)
```

---

## 14. Bitácora

| Fecha | Hito |
|---|---|
| 2026-11-11 | Entorno restaurado: 3 servicios + 2 bases, arranque reproducible, README |
| 2026-11-11 | Fase 1 completa: 16 documentos, 6 ADRs, glosario, 47 hallazgos |
| 2026-11-11 | Detectado F-07 (deriva de esquema) y F-10 (ingredientes vacíos) |
| 2026-11-11 | F-07 resuelto: migración `20261111031957`, `/quests/available` y `/users/profile` → 200 |
| 2026-11-11 | F-10 resuelto: seed de 51 ingredientes + `db:seed` reproducible; custom food creado end-to-end |
| 2026-11-11 | F-01 resuelto: `register` con `Custom` sin metas → 400 (antes 500) |
| 2026-11-11 | F-03 resuelto: advisory lock por día; concurrencia e invariante de puntos/racha verificados |
