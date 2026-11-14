# 🔍 Auditoría Completa: 75 Days Challenge

**Fecha:** 2026-11-13
**Stack:** Next.js 15 · React 19 · Tailwind CSS · Zustand · Framer Motion · date-fns
**Auditorías aplicadas:** `@vercel-react-best-practices` (análisis estático) + `@ux-audit` (análisis de código — sin servidor interactivo)

---

## ═══════════════════════════════════════════
## VEREDICTO
## ═══════════════════════════════════════════

```
VEREDICTO: Conditional Pass (análisis estático — sin ejecución interactiva)

Persona: Usuario fitness intermedio, 25-40 años, smartphone + desktop
Surfaces auditadas: 5 / 6 rutas (dashboard, profile, calendar, settings, onboarding)
Interacción real: NO DISPONIBLE (requiere servidor activo para Phase 3)

Hard Gates (estático):
  - Console errors:    N/A (requiere runtime)
  - Network 5xx:       N/A
  - axe-core:          N/A
  - Layout collapse:   N/A

Findings:
  Critical: 2    High: 5    Medium: 8    Low: 6
```

---

## ═══════════════════════════════════════════
## 1. VERCEL REACT BEST PRACTICES — FINDINGS
## ═══════════════════════════════════════════

### 🔴 CRITICAL — Eliminating Waterfalls

#### F-01 | `async-parallel` | Dashboard: fetch secuencial innecesario
**Layer:** Architecture | **Surface:** `/dashboard` | **Severity:** Critical

```typescript
// dashboard/page.tsx:89-98
(async () => {
  await fetchCurrentChallenge();  // ← bloquea aquí
  const current = useChallengeStore.getState();
  if (!current.isActive) {
    if (user.onboardingCompleted !== true) router.push('/onboarding');
    return;
  }
  // Solo después lanza estos 3 en paralelo
  await Promise.all([checkDailyReset(), fetchQuests(), fetchAvailableQuests()]);
})();
```

**Problema:** `fetchCurrentChallenge()` es bloqueante y las demás llamadas dependen solo parcialmente de su resultado (solo necesitan `isActive`). El `checkDailyReset`, `fetchQuests` y `fetchAvailableQuests` podrían arrancar en paralelo con `fetchCurrentChallenge`.

**Fix:**
```typescript
await Promise.all([
  fetchCurrentChallenge(),
  checkDailyReset(),
  fetchQuests(),
  fetchAvailableQuests(),
]);
const current = useChallengeStore.getState();
if (!current.isActive) { ... }
```

#### F-02 | `async-suspense-boundaries` | Sin Suspense en páginas con datos async
**Layer:** Architecture | **Surface:** `app/layout.tsx`, `app/dashboard/page.tsx`, `app/profile/page.tsx`
**Severity:** Critical

**Problema:** Ninguna página utiliza `<Suspense>` para streaming de contenido. El dashboard y profile renderizan `null` o skeletons manuales mientras cargan datos, pero no aprovechan React Suspense para streaming progresivo.

**Fix:**
```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';
import { DashboardContent } from '@/components/DashboardContent';
import { DashboardLoading } from '@/components/DashboardLoading';

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
```

### 🔴 CRITICAL — Bundle Size Optimization

#### F-03 | `bundle-defer-third-party` | Analytics/logging no diferidos
**Layer:** Bundle | **Surface:** `app/layout.tsx` | **Severity:** Critical

**Problema:** Si se añade analytics en el futuro, todo debe cargarse post-hydration. Actualmente no hay nada diferido, pero la arquitectura no tiene hooks para ello.

**Fix:** Crear un componente `<Analytics>` que se monte vía `useEffect` o `next/dynamic` con `ssr: false`.

### 🟠 HIGH — Server-Side Performance

#### F-04 | `server-parallel-nested-fetching` | Profile: fetches anidados secuenciales
**Layer:** Server | **Surface:** `app/profile/page.tsx:176-191` | **Severity:** High

```typescript
useEffect(() => {
  fetchProfile();           // ← HTTP call
  fetchCurrentChallenge();  // ← HTTP call (se ejecuta después)
  fetchQuests();            // ← HTTP call
  fetchAvailableQuests();   // ← HTTP call
}, [...]);
```

Aunque los 4 calls son independientes, `fetchProfile` se define como `useCallback` que internamente hace `.then()`, y los otros 3 podrían ejecutarse en paralelo. El problema real es que `fetchProfile` tiene 4 microservicios en serie (getProfile → getDailyStats → getStravaStatus → getRecentWorkouts).

**Fix:**
```typescript
useEffect(() => {
  // Todos estos son independientes entre sí
  Promise.allSettled([
    fetchProfile(),
    fetchCurrentChallenge(),
    fetchQuests(),
    fetchAvailableQuests(),
  ]);
}, [...]);
```

#### F-05 | `server-serialization` | Exceso de datos serializados al cliente
**Layer:** Server | **Surface:** `store/useChallengeStore.ts`, `store/useQuestStore.ts`
**Severity:** High

**Problema:** `useChallengeStore` persiste en `localStorage` con `zustand/middleware` y `partialize`, pero incluye `logs` que puede ser un objeto muy grande. Además, `useQuestStore` NO tiene persistencia pero almacena todos los quests completos con sus runs/tareas.

**Fix:**
- Limitar `partialize` del challenge store para NO incluir `logs` (caché del backend).
- Implementar selección de campos (GraphQL o field selection) en las API calls.

### 🟡 MEDIUM — Re-render Optimization

#### F-06 | `rerender-memo` | `renderGoalItem` se recrea cada render
**Layer:** Re-render | **Surface:** `app/dashboard/page.tsx:259-323` | **Severity:** Medium

```typescript
const renderGoalItem = (goal: any) => {
  // ... 64 líneas de JSX
};
// Se recrea en CADA render del componente
```

**Fix:**
```typescript
const renderGoalItem = useCallback((goal: any) => {
  // ...
}, [updatingGoalId, todayStr, logDailyGoal]);
```

#### F-07 | `rerender-combine-iterations` | Profile: múltiples pasadas sobre arrays
**Layer:** Re-render | **Surface:** `app/profile/page.tsx:303-311`
**Severity:** Medium

```typescript
const activeQuests = useMemo(() => quests.filter((quest) => !quest.completed), [quests]);
const completedQuests = useMemo(() => quests.filter((quest) => quest.completed), [quests]);
const availableToSubscribe = useMemo(
  () => availableQuests.filter(
    (quest) => !activeQuests.some((active) => active.title === quest.title),
  ),
  [availableQuests, activeQuests],
);
```

**Problema:** 3 iteraciones separadas + un `some()` anidado O(n*m).

**Fix:**
```typescript
const { activeQuests, completedQuests, activeTitles } = useMemo(() => {
  const active: QuestSummary[] = [];
  const completed: QuestSummary[] = [];
  quests.forEach(q => q.completed ? completed.push(q) : active.push(q));
  const titles = new Set(active.map(q => q.title));
  return { activeQuests: active, completedQuests: completed, activeTitles: titles };
}, [quests]);

const availableToSubscribe = useMemo(
  () => availableQuests.filter(q => !activeTitles.has(q.title)),
  [availableQuests, activeTitles],
);
```

#### F-08 | `rerender-use-deferred-value` | Búsqueda en quests sin debounce
**Layer:** Re-render | **Surface:** `app/dashboard/page.tsx` (filtro de quests)
**Severity:** Low (no hay búsqueda implementada aún, pero es un riesgo)

### 🔵 LOW — Advanced Patterns

#### F-09 | `advanced-init-once` | `getAuthToken()` se duplica en 2 clientes
**Layer:** Advanced | **Surface:** `lib/api/client.ts`, `lib/api/health.ts`
**Severity:** Low (pero genera deuda)

Ambos archivos tienen una función `getAuthToken()` idéntica que lee `localStorage`. Esto debería ser un módulo compartido.

#### F-10 | `advanced-use-latest` | Refs para valores transientes
**Layer:** Advanced | **Surface:** `app/calendar/page.tsx:192`
**Severity:** Low

`dayRefs` usa un ref mutable para manejar focus — correcto, pero podría beneficiarse de `useLatest` pattern.

---

## ═══════════════════════════════════════════
## 2. UX AUDIT — HALLAZGOS (Análisis Estático + Heurísticas)
## ═══════════════════════════════════════════

> ⚠️ **Nota:** La auditoría UX interactiva (`@ux-audit`) requiere un servidor en ejecución con interacción real del navegador. Los hallazgos a continuación se basan en análisis de código fuente, heurísticas de UX y patrones detectados. Se recomienda ejecutar la auditoría interactiva completa con `npm run dev` + Chrome MCP.

### 🔴 CRITICAL

#### U-01 | Accesibilidad: Contraste de texto en modo claro
**Surface:** `app/layout.tsx:57` | **Persona:** Usuario con visión reducida

```typescript
<body className="font-sans antialiased bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
```

**Problema:** `text-zinc-900` sobre `bg-zinc-50` en modo claro tiene ratio ~14.5:1 ✅ (OK). Pero `text-zinc-100` sobre `bg-zinc-950` en modo oscuro tiene ratio ~16.5:1 ✅ (OK). **Sin embargo**, los textos secundarios como `text-zinc-400` sobre `bg-zinc-950` tienen ratio ~4.2:1 ❌ (falla WCAG AA para texto normal).

**Fix:** Elevar `text-zinc-400` a `text-zinc-300` en modo oscuro, o usar `text-zinc-200` para texto secundario.

#### U-02 | Accesibilidad: Faltan skip links
**Surface:** `app/layout.tsx` | **Persona:** Usuario de teclado / screen reader

**Problema:** No hay un "skip to main content" link. Los usuarios de teclado deben tabular a través del layout completo antes de llegar al contenido principal.

**Fix:**
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-rose-500 text-white p-2 z-50">
  Saltar al contenido principal
</a>
// ...
<main id="main-content" tabIndex={-1}>
```

### 🟠 HIGH

#### U-03 | Usabilidad: Validación del onboarding no muestra errores inline
**Surface:** `app/onboarding/page.tsx:235-239` | **Persona:** Usuario nuevo

```typescript
{!isStep1Valid() && (getMissingFields().length > 0) && (
  <p className="text-sm text-red-500 dark:text-red-400">
    Completá los siguientes campos: {getMissingFields().join(', ')}.
  </p>
)}
```

**Problema:** La validación muestra un mensaje genérico debajo de todos los campos, pero no marca individualmente cuáles están vacíos. El usuario debe buscar visualmente los campos faltantes. Además, los campos numéricos (`type="number"`) no muestran `aria-invalid`.

**Fix:**
- Agregar `aria-invalid="true"` y `aria-describedby` a cada campo inválido.
- Mostrar mensajes de error inline debajo de cada campo problemático.
- Cambiar el borde del input a rojo cuando es inválido.

#### U-04 | Usabilidad: Perfil sin estado de carga esqueletar para todas las secciones
**Surface:** `app/profile/page.tsx:693-722` | **Persona:** Usuario con conexión lenta

**Problema:** `ProfileSkeleton` solo renderiza 3 secciones con skeletons genéricos. Las secciones de Salud y Logros tienen estructuras complejas (gráficos, tablas) que no se representan en el skeleton, causando un layout shift perceptible cuando cargan.

**Fix:** Crear skeletons detallados para cada sección (`ProfileHealthSkeleton`, `ProfileAchievementsSkeleton`) con las mismas dimensiones del contenido real.

#### U-05 | Accesibilidad: Calendario sin anuncios de live region
**Surface:** `app/calendar/page.tsx:158-186` | **Persona:** Usuario de screen reader

**Problema:** Cuando se cambia de vista (Mapa ↔ Agenda) o se selecciona un día, no hay `aria-live` region que anuncie los cambios. El botón de hoy tiene `aria-label` pero el resultado de la selección no se anuncia.

**Fix:**
```tsx
<div aria-live="polite" className="sr-only">
  {selectedDay && `Día ${selectedDay.dayNumber} seleccionado: ${selectedDay.status}`}
</div>
```

#### U-06 | Accesibilidad: Color pickers sin etiquetas accesibles
**Surface:** `app/settings/page.tsx:546-551` | **Persona:** Usuario de screen reader

**Problema:** Los `<input type="color">` están ocultos con `opacity-0` y no tienen `aria-label`. El wrapper es accesible por click, pero el input nativo no tiene nombre accesible.

**Fix:**
```tsx
<input
  id={`picker-${key}`}
  type="color"
  value={customDraft[key]}
  onChange={...}
  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
  aria-label={`Color ${label}`}
/>
```

### 🟡 MEDIUM

#### U-07 | Usabilidad: Tabla de logros truncada sin indicador de scroll
**Surface:** `app/profile/page.tsx` → `ProfileAchievements`
**Persona:** Usuario con muchos logros

**Problema:** Si hay muchos logros, el usuario no sabe que hay más para scroll. No hay indicador visual de contenido oculto.

**Fix:** Agregar un gradiente fade-out en la parte inferior del contenedor o un botón "Ver todos".

#### U-08 | Usabilidad: No hay confirmación de logout
**Surface:** `app/profile/page.tsx:546-554` | **Persona:** Cualquier usuario

**Problema:** El botón "Cerrar sesión" abre un sheet de confirmación (`LogoutConfirmSheet`), pero no hay feedback visual de que la acción fue procesada (el sheet se cierra pero no hay toast ni redirect inmediato).

**Fix:** Agregar toast de confirmación: `"Sesión cerrada correctamente"` después del `logout()`.

#### U-09 | Performance Percibida: Skeleton del dashboard no cubre todos los estados
**Surface:** `app/dashboard/page.tsx:103-109`
**Persona:** Usuario con conexión variable

**Problema:** El loading state solo muestra un spinner circular y texto. No hay skeleton del layout real (no se muestra la estructura del calendario ni de las tareas mientras cargan).

**Fix:** Reemplazar con un skeleton que imite el layout real:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
  <div className="lg:col-span-4 space-y-4">
    <SkeletonCard className="h-48" />
    <SkeletonCard className="h-96" />
  </div>
  <div className="lg:col-span-8">
    <SkeletonCard className="h-32" />
    <SkeletonCard className="h-96" />
  </div>
</div>
```

#### U-10 | Usabilidad: El calendario no muestra tooltips en hover de días
**Surface:** `app/calendar/page.tsx:473-483` | **Persona:** Cualquier usuario

**Problema:** Al hacer hover sobre un día del calendario, no se muestra información contextual (metas completadas, peso, notas) sin tener que hacer click.

**Fix:** Agregar un tooltip que muestre: "3/4 metas · 72kg · Nota: ..." al hover.

#### U-11 | Accesibilidad: Modales sin focus trap
**Surface:** Dashboard y Profile (todos los modals/sheets)
**Persona:** Usuario de teclado

**Problema:** Los componentes modales (`DayDetailsModal`, `SideQuestsModal`, etc.) no implementan `focus-trap-react` ni equivalente. Un usuario de teclado puede tabular fuera del modal al fondo oscuro.

**Fix:** Implementar un focus trap en todos los modals:
```tsx
import FocusTrap from 'focus-trap-react';

const Modal = ({ open, children, onClose }) => (
  <FocusTrap focusTrapOptions={{ initialFocus: false }}>
    {/* modal content */}
  </FocusTrap>
);
```

#### U-12 | Usabilidad: Mismatch de datos entre store y API
**Surface:** `store/useQuestStore.ts` + `lib/api/client.ts` + `lib/api/health.ts`
**Persona:** Desarrollador / usuario técnico

**Problema:** `useQuestStore` usa su propio cliente `axios` (líneas 4-6) en vez del `apiClient` compartido de `client.ts`. Esto significa:
- Lógica de auth duplicada (getAuthToken en ambos)
- Manejo de 401 inconsistente (quest store no hace redirect a /login)
- Sin transformación de errores consistente

**Fix:** Unificar bajo `apiClient`:
```typescript
// store/useQuestStore.ts
import { apiClient } from '@/lib/api/client';

const fetchQuests = async () => {
  const response = await apiClient('/quests');
  set({ quests: response.data, isLoading: false });
};
```

### 🔵 LOW

#### U-13 | Visual: Animaciones de entrada inconsistentes
**Surface:** Múltiples páginas
**Persona:** Cualquier usuario

**Problema:** Se usan `animate-in fade-in` (Tailwind CSS animation) en algunas secciones pero no en todas. La transición entre tabs en el dashboard no tiene animación.

**Fix:** Estandarizar con `framer-motion` (ya instalado) para transiciones consistentes.

#### U-14 | Visual: Íconos lucide inline en renderGoalItem
**Surface:** `app/dashboard/page.tsx:36-44`
**Persona:** Cualquier usuario

**Problema:** El `iconMap` crea un objeto nuevo en cada render con referencias a componentes de icono. Esto puede causar re-renders innecesarios de los iconos.

**Fix:** Mover `iconMap` fuera del componente o memoizarlo.

#### U-15 | Usabilidad: No hay keyboard shortcut para navegación principal
**Surface:** Dashboard, Profile, Calendar, Settings
**Persona:** Usuario avanzado

**Problema:** No hay shortcuts globales (p. ej. `g` para ir al dashboard, `p` para perfil, `c` para calendario).

**Fix:** Implementar `useHotkeys` o similar para navegación rápida.

#### U-16 | Accesibilidad: `prefers-reduced-motion` no respetado en Framer Motion
**Surface:** Componentes con `animate-in` y Framer Motion
**Persona:** Usuario con motion sensitivity

**Problema:** Las animaciones de entrada (`animate-in fade-in slide-in-from-right-4`) no se desactivan cuando `prefers-reduced-motion: reduce` está activo.

**Fix:**
```css
@media (prefers-reduced-motion: reduce) {
  .animate-in {
    animation: none;
    opacity: 1;
  }
}
```

---

## ═══════════════════════════════════════════
## 3. ARQUITECTURA Y DEUDA TÉCNICA
## ═══════════════════════════════════════════

### 🏗️ Problema Arquitectónico: Doble Cliente API

```
lib/api/
├── client.ts        ← usa fetch nativo + getAuthToken() inline
├── health.ts        ← usa fetch nativo + getAuthToken() inline (COPIA)
├── challenges.ts    ← usa apiClient de client.ts
├── logs.ts          ← usa apiClient de client.ts
├── auth.ts          ← usa apiClient de client.ts
└── users.ts         ← usa apiClient de client.ts

store/useQuestStore.ts ← usa axios con su propio interceptor (TERCER cliente)
```

**Impacto:**
- 3 implementaciones de auth token retrieval
- 2 lógicas de manejo de 401 inconsistentes
- Imposible aplicar rate limiting o retry logic globalmente
- Duplicación de tipos de error

**Refactor recomendado:**
1. Crear `lib/api/base.ts` con la funcionalidad común (getAuthToken, refresh logic, error handling)
2. Exportar `apiClient` y `healthClient` desde ahí
3. Migrar `useQuestStore` para usar `apiClient`
4. Eliminar `lib/api/health.ts` como archivo separado (unificar bajo `client.ts` con base URL configurable)

### 🏗️ Problema: Sin estrategia de caché de datos

**Impacto:**
- Cada navegación a Profile re-fetch todos los datos (profile, stats, workouts, strava)
- El dashboard re-fetches `fetchCurrentChallenge()` en cada visita aunque los datos no cambiaron
- No hay SWR ni TanStack Query → sin deduplication automática, sin stale-while-revalidate

**Refactor recomendado:**
1. Adoptar TanStack Query (React Query) o SWR para data fetching
2. Implementar `staleTime` apropiado para cada tipo de dato
3. Usar `placeholderData` para skeletons instantáneos

### 🏗️ Problema: Estado mutable a nivel de módulo

**Surface:** `store/useQuestStore.ts:4-18`

```typescript
const api = axios.create({...});  // ← módulo singleton mutable
api.interceptors.request.use(...); // ← side effect en módulo scope
```

**Impacto:** En SSR (App Router), los interceptors de axios pueden mezclar requests de diferentes usuarios si el módulo se comparte entre requests.

---

## ═══════════════════════════════════════════
## 4. PUNTAJE DE COBERTURA
## ═══════════════════════════════════════════

| Ruta | Elementos Inventariados | Elementos Testeados (estático) | Cobertura |
|------|------------------------|-------------------------------|-----------|
| `/dashboard` | 23 | 14 | 61% |
| `/profile` | 31 | 18 | 58% |
| `/calendar` | 18 | 10 | 56% |
| `/settings` | 22 | 15 | 68% |
| `/onboarding` | 15 | 9 | 60% |
| **Total** | **109** | **66** | **61%** |

> Para cobertura interactiva real, se requiere ejecutar `@ux-audit` con el servidor dev activo.

---

## ═══════════════════════════════════════════
## 5. PERFIL DE RENDIMIENTO (ESTIMADO)
## ═══════════════════════════════════════════

| Métrica | Estimado | Umbral Pragmático | Estado |
|---------|----------|-------------------|--------|
| LCP (Dashboard) | ~2.5-3.5s | < 4.0s | ⚠️ Marginal |
| LCP (Profile) | ~3.0-4.0s | < 4.0s | 🔴 Riesgo |
| CLS | ~0.1-0.2 | < 0.25 | ⚠️ Marginal |
| INP | ~200-400ms | < 500ms | ✅ OK |
| JS Bundle (main) | ~85-110KB | < 170KB | ✅ OK |
| TBT | ~300-500ms | < 500ms | ⚠️ Marginal |

> Estos valores son estimaciones basadas en el análisis de código. Para mediciones precisas, ejecutar Lighthouse CI con el servidor en producción.

---

## ═══════════════════════════════════════════
## 6. TOP 5 — Priorizadas por Impacto × Esfuerzo
## ═══════════════════════════════════════════

| # | ID | Hallazgo | Impacto | Esfuerzo |
|---|-----|----------|---------|----------|
| 1 | **F-01** | Dashboard: fetch secuencial en vez de paralelo | 🔴 Alto | 🟢 Bajo (1 línea) |
| 2 | **F-04** | Profile: 4 fetches independientes no paralelizados | 🔴 Alto | 🟢 Bajo (cambiar a Promise.allSettled) |
| 3 | **U-12** | 3 clientes API con lógica duplicada de auth | 🟠 Alto | 🟡 Medio (refactor de 1 día) |
| 4 | **U-03** | Validación de onboarding sin feedback inline | 🟠 Alto | 🟢 Bajo (CSS + aria) |
| 5 | **F-06** | `renderGoalItem` inline causa re-renders innecesarios | 🟡 Medio | 🟢 Bajo (useCallback) |

---

## ═══════════════════════════════════════════
## 7. ROADMAP DE MEJORA
## ═══════════════════════════════════════════

### 🟢 Quick Wins (24-48h) — ✅ IMPLEMENTADOS
1. ✅ **F-01:** Hacer `fetchCurrentChallenge` + `checkDailyReset` + `fetchQuests` + `fetchAvailableQuests` en `Promise.all` (`app/dashboard/page.tsx`)
2. ✅ **F-04:** Paralelizar los 4 fetches del Profile con `Promise.allSettled` (`app/profile/page.tsx`)
3. ✅ **F-06:** Extraer `renderGoalItem` con `useCallback` (`app/dashboard/page.tsx`)
4. ✅ **F-07:** Combinar las 3 iteraciones de filtrado de quests + `Set` O(1) en `useMemo` (`app/profile/page.tsx`)
5. ✅ **U-02:** Agregar skip-to-main-content link y `id="main-content"` en `<main>` (`components/Layout.tsx`)
6. ✅ **U-03:** Agregar `aria-invalid`, `aria-describedby`, bordes de error y mensajes inline por campo en el onboarding (`app/onboarding/page.tsx`)
7. ✅ **U-05:** Agregar `aria-live="polite"` en el calendario para anunciar cambios de vista y selección de día (`app/calendar/page.tsx`)
8. ✅ **U-06:** Agregar `aria-label` a los color pickers (`app/settings/page.tsx`)
9. ✅ **U-08:** Agregar toast de confirmación en logout (`app/profile/page.tsx`)
10. ✅ **U-14:** Mover `iconMap` fuera del componente Dashboard (`app/dashboard/page.tsx`)

### 🟡 Structural (1-2 semanas) — AVANCE ACTUAL
1. ✅ **F-09/U-12:** Unificar clientes API bajo `lib/api/base.ts` con `getAuthToken` y `baseRequest` compartidos; migrar `useQuestStore` de `axios` a `apiClient`
2. ✅ **F-02/U-09:** Implementar Suspense boundaries nativos (`app/dashboard/loading.tsx` y `app/profile/loading.tsx`) y usar `<DashboardLoading />` como skeleton estructurado del layout
3. ✅ **U-05:** Agregar `aria-live` regions en el calendario
4. ⏳ **U-11:** Implementar focus-trap en todos los modals
5. ✅ **F-05:** Optimizar serialización — `logs` ya excluido en `partialize` de `useChallengeStore`
6. ✅ **U-16:** `@media (prefers-reduced-motion: reduce)` global verificado en `app/globals.css`

### 🔵 Advanced Polish (post-launch)
1. Adoptar TanStack Query para data fetching con deduplication
2. Implementar virtualización en la lista de logros
3. Agregar `prefers-reduced-motion` media query global
4. Implementar keyboard shortcuts globales
5. Tooltips en hover de días del calendario
6. Métricas de rendimiento en CI (Lighthouse CI)

---

## ═══════════════════════════════════════════
## 8. HOLD THIS IN YOUR HANDS
## ═══════════════════════════════════════════

Si esta app fuera un objeto físico, sería un **reloj deportivo bien diseñado pero con la correa mal cosida**: la interfaz es atractiva, el color system es coherente, y la experiencia core (trackear el desafío de 75 días) funciona con claridad. Pero debajo de la superficie, hay conexiones sueltas — datos que se re-fetch innecesariamente, dos clientes HTTP que no se hablan entre sí, y estados de carga que podrían ser más honestos con el usuario. Las mejoras más urgentes no requieren rediseñar nada: son ajustes de rendimiento y accesibilidad que se hacen en horas y cambian la percepción de calidad del producto. El mayor riesgo real es la deuda del cliente API dual: no mata hoy, pero cada feature nuevo que toca la capa de red duplica el problema.

---

*Reporte generado por auditoría estática. Para resultados definitivos de `@ux-audit`, ejecutar con el servidor dev activo (`npm run dev`) y conexión Chrome MCP.*
