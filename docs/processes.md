# Processes

> Ancla: controladores de ambos backends y `apps/frontend/store`, `apps/frontend/app`.
> Confianza: **Leído**; los flujos marcados **Medido** se ejecutaron contra los servicios corriendo.

Los diagramas viven en prosa por ahora; `docs/diagrams/` queda pendiente (ver `coverage.md`).

---

## 1. Registro y arranque del reto

**Medido.**

```
Usuario → POST /api/auth/register
  └─ valida { name, email, password, difficulty }
  └─ verifica email único
  └─ hash bcrypt (costo 10)
  └─ TRANSACCIÓN:
       ├─ crea User
       ├─ crea Challenge (difficulty, isActive=true, currentDay=1)
       ├─ crea GoalTemplate[] según dificultad
       └─ crea DailyLog de hoy con DailyGoal[] copiadas de las plantillas
  └─ firma JWT { id } a 7 días
  └─ responde 201 { token, user, challenge }
Frontend: guarda token y usuario en auth-storage → redirige a /onboarding
```

**Puntos de atención**: las metas por defecto no son las mismas que usa `POST /challenges/start` (F-02). La validación de `Custom` sin plantilla ya devuelve 400 (F-01 resuelto).

---

## 2. Login y restauración de sesión

**Medido.**

```
POST /api/auth/login → 200 { token, user }
Frontend: persiste en auth-storage

Al recargar:
AuthGuard espera hidratación
  └─ checkAuth() → GET /api/auth/me
       ├─ 200 → usuario fresco, sesión válida
       └─ 401 → limpia token y estado, redirige a /login
  └─ checkOnboardingStatus() → GET /api/auth/onboarding-status
       └─ si false → fuerza /onboarding
```

**Puntos de atención**: el token se guarda en `localStorage` (accesible por XSS). No hay refresh: a los 7 días la sesión muere sin aviso.

---

## 3. Onboarding

```
/onboarding
  └─ usuario completa edad, peso, altura, peso objetivo
  └─ elige plan (PlansModal) y dificultad
  └─ POST /api/challenges/start  (si el reto del registro no sirve)
  └─ PATCH /api/auth/complete-onboarding { age, weight, targetWeight, height }
  └─ redirige a /dashboard
```

**Puntos de atención**: el registro ya creó un reto. Si el usuario elige otro plan, se inicia un reto nuevo y el anterior queda inactivo con su primer día huérfano de historial visible.

---

## 4. Ciclo diario del reto

**Medido parcialmente** (registro, consulta del reto y marcado de metas verificados).

```
Al abrir /dashboard:
  1. POST /api/logs/check-reset { timezoneOffset }
       ├─ calcula hoy y ayer en hora local del navegador
       ├─ calcula currentDay desde startDate
       ├─ si ayer existe y no fue success:
       │     ├─ marca ayer como fail si estaba pending
       │     └─ racha = 0
       ├─ si hoy no existe: lo crea copiando las plantillas del reto
       └─ devuelve { streak, currentDay, logs[] }
  2. GET /api/challenges/current
  3. GET /api/quests
  4. GET /api/quests/available   ← hoy 500 (tabla ausente)

Usuario marca una meta:
  PUT /api/logs/:date/goal/:goalId { completed }
       ├─ actualiza el DailyGoal
       ├─ si todas las metas quedaron completas:
       │     ├─ DailyLog.status = success
       │     └─ Challenge: +10 puntos, +1 racha
       └─ si se desmarcó una de un día exitoso:
             ├─ DailyLog.status = pending
             └─ Challenge: −10 puntos, −1 racha (piso 0)
  Frontend: actualización optimista, revert si falla
```

**Puntos de atención**: si el usuario no abre la app, el día no se cierra (F-04). Las marcas concurrentes del mismo día se serializan con un advisory lock; la racha ya no pierde actualizaciones (F-03 resuelto).

---

## 5. Registro de nutrición

```
Perfil → LogMealModal
  ├─ (opcional) buscar en FatSecret: GET /api/fatsecret/search?query=
  ├─ (opcional) importar alimento: POST /api/fatsecret/import/:id → Ingredient
  ├─ (opcional) crear alimento propio: POST /api/nutrition/custom-foods
  │     └─ requiere ingredientes existentes → 51 en el seed base (F-10 resuelto)
  └─ POST /api/nutrition/meals { date, mealType, name, calories, macros }
Frontend → GET /api/stats/daily/:date para recalcular el balance
```

**Puntos de atención**: sin credenciales de FatSecret no hay forma de poblar ingredientes, así que la creación de alimentos personalizados es inalcanzable en desarrollo.

---

## 6. Registro de entrenamiento

```
Perfil → LogWorkoutModal
  └─ POST /api/workouts { date, sport, durationMin, intensity, ... }
       ├─ si viene caloriesBurned → se respeta (manual)
       └─ si no → estima con MET × peso × duración × intensidad × ajuste por altura
```

**Sincronización con Strava**:

```
Perfil → GET /api/strava/auth → { url }
  └─ usuario autoriza en Strava
  └─ Strava → GET /api/strava/callback?code=&state=<userId>
       ├─ intercambia código por tokens
       ├─ guarda tokens en UserHealthProfile
       └─ redirige a /profile?strava=success

Perfil → POST /api/strava/sync
  └─ refresca el token si expira en <5 min
  └─ pide actividades de los últimos 30 días
  └─ descarta las ya importadas por externalId
  └─ crea WorkoutEntry con source=strava
```

---

## 7. Perfil y logros

**Medido**: hoy falla con 500.

```
GET /api/users/profile
  └─ recorre TODOS los retos y TODOS sus logs del usuario
  └─ calcula: días exitosos, mejor racha, peso inicial, mejor peso, kg perdidos
  └─ evalúa 6 logros
  └─ upsert de cada logro (escribe)
  └─ responde { user, stats, achievements }
Frontend: Promise.all con stats, Strava y workouts
```

**Puntos de atención**: una lectura escribe (F-05); "peso actual" es el mejor peso (F-06); si este endpoint falla, el frontend pierde también los datos de salud (F-31).

---

## 8. Abandono del reto

```
POST /api/challenges/abandon
  ├─ si el reto activo tiene <24 h → DELETE (borra metas y logs)
  └─ si tiene ≥24 h → isActive=false (conserva historial)
Frontend: limpia el store del reto
```

---

## Dependencias entre procesos

| Proceso | Depende de |
|---|---|
| Ciclo diario | Que el frontend se abra (no hay scheduler) |
| Racha | Solo metas marcadas a mano; **no** depende de dieta ni entrenamiento |
| Logros | Historial completo de retos y logs |
| Nutrición | Catálogo de ingredientes o FatSecret |
| Sincronización Strava | Token OAuth vigente |
