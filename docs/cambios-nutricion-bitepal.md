# Cambios — Nutrición Bitepal (Pantalla de Nutrición)

## 🎯 Objetivo
Transformar la pantalla de `/nutrition` en una experiencia inspirada en Bitepal: 3 tarjetas visualmente separadas (Calorías consumidas, Calorías por quemar, Plan de comidas), fotografía de comida, FAB (+) y mejor layout, todo con tokens del design system.

## 📋 Especificaciones Técnicas

### 1. Estructura de la Pantalla (final)
- **Header**: "Registro alimentario" + título `Nutrición` + selector de fecha (Hoy / Ayer / fecha).
- **Card 1: Calorías consumidas** (`aria-label="Calorías consumidas"`)
  - Valor consumido `/ ${dailyGoal} kcal` + chip de estado (`X restantes` / `+Y kcal`).
  - Progress bar de calorías (`--progress-track` → `--progress-fill`).
  - 3 columnas de macros (Proteínas / Carbos / Grasas) con barras y colores de gráfico.
  - Filas opcionales de fibra / azúcares.
  - `FoodPhotoGrid` con miniaturas circulares (placeholders determinísticos, `aria-hidden`).
  - Meta con menú kebab + editor inline de metas (formulario con `healthService.updateGoals`).
- **Card 2: Calorías por quemar** (`components/CaloriesBurnedCard.tsx`)
  - Calorías quemadas, meta alcanzada, pasos (placeholder `0` hasta integrar backend).
- **Card 3: Plan de comidas** (`components/MealsPlanCard.tsx`)
  - Lista de comidas con foto circular, nombre, kcal y tiempo de preparación.
  - Botones accesibles vía contenido visible (sin `aria-label` redundante que rompía `label-content-name-mismatch`).
- **FAB**: `components/FloatingActionButton.tsx`, se posiciona sobre la Card 3 (`absolute bottom-0 right-0 -translate-y-1/2 -translate-x-1/2`).
  - Abre `LogMealModal` (slot opcional para logear comida).
- **Bottom nav**: el ícono de Nutrición ya estaba activo en `components/Layout.tsx` (`pathname === '/nutrition'`).

### 2. Estilo y Tokens de Diseño
- Colores: `--surface-card`, `--surface-inset`, `--border-subtle`, `--divider`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-text`, `--accent-fill`, `--on-accent`, `--progress-track`, `--progress-fill`, `--status-warning`, `--status-success`, `--chart-protein`, `--chart-carb`, `--chart-fat`.
- Tipografía/espaciado: tokens Tailwind (`text-[11px]`, `text-[13px]`, `text-[15px]`, `text-[28px]`, etc.).

### 3. Componentes Clave
- `apps/frontend/components/FoodPhotoGrid.tsx` — miniaturas decorativas (`aria-hidden="true"`, glifos determinísticos por `mealType`).
- `apps/frontend/components/CaloriesBurnedCard.tsx` — quema + pasos + meta alcanzada.
- `apps/frontend/components/MealsPlanCard.tsx` — lista de plan de comidas.
- `apps/frontend/components/FloatingActionButton.tsx` — FAB con animación.
- `apps/frontend/app/nutrition/page.tsx` — orquesta las 3 cards + header + modales + selector de fecha.

### 4. Validación
- `npx tsc --noEmit`: ✅ sin errores en los archivos tocados.
- `npx playwright test tests/nutrition-section.spec.ts`: ✅ 2 passed (light + dark) en viewport 375x812.
- Fix de accesibilidad aplicado: se eliminó el `aria-label` "Ver detalles de X" en `MealsPlanCard` (el texto visible no se estaba incluyendo en el accessible name) y se añadió `aria-hidden="true"` a la foto decorativa.

## 🧩 Archivos Modificados / Creados

| Archivo | Cambio |
|---|---|
| `apps/frontend/components/FloatingActionButton.tsx` | Creado (FAB con animación). |
| `apps/frontend/components/FoodPhotoGrid.tsx` | Creado (miniaturas decorativas). |
| `apps/frontend/components/CaloriesBurnedCard.tsx` | Creado (ajustado íconos `ChevronsDownUp` / `Footprints` por versiones válidas de lucide-react 0.553). |
| `apps/frontend/components/MealsPlanCard.tsx` | Creado (botón accesible sin aria-label redundante). |
| `apps/frontend/app/nutrition/page.tsx` | Refactorizado: eliminada la tarjeta duplicada "Resumen calórico del día" y ahora renderiza las 3 cards + FAB. |

## ✅ Criterios de Éxito
- [x] 3 tarjetas visualmente separadas con estilo Bitepal.
- [x] Fotos de comida (placeholders determinísticos).
- [x] FAB (+) funcional y animado.
- [x] Bottom navigation activa en ícono de Nutrición.
- [x] Compatibilidad con tests existentes (`tests/nutrition-section.spec.ts` ✅).
- [x] Diseño coherente con dark/light themes (tokens CSS custom properties).
- [ ] Pasos reales del backend aún pendientes (placeholder `0`).

---

## Cierre

### Resumen de cambios
- Se consolidó la pantalla de Nutrición en 3 cards independientes:
  1. **Calorías consumidas** — consumido/objetivo + progreso + macros + fotos + metas.
  2. **Calorías por quemar** — quema, pasos, meta alcanzada.
  3. **Plan de comidas** — lista de comidas + FAB para registrar.
- Se eliminó la tarjeta duplicada que rompía los tests con `strict mode violation` (valores repetidos).

### Interacción entre archivos
- `page.tsx` consume `useHealthStore` (`dailyStatsByDate`, `isLoadingStats`, `fetchProfileBundle`) y pasa datos a las cards.
- Las cards y el FAB delegan acciones (`onPressAdd`, `onMealPress`) al page, que abren `LogMealModal` / `EditMealModal`.

### Motivo técnico
- Extraer componentes purificó el layout y permitió testear/fijar estilos por tarjeta.
- Los tests de Playwright fallaban por (a) render previo al fix de imports y (b) accesibilidad. Ambos resueltos.

---

> **Nota**: Este documento debe actualizarse incrementalmente con cada cambio de archivo realizado.
