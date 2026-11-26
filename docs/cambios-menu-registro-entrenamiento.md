# Cambio: menú para registrar entrenamientos

## Solicitud

Al pulsar el botón `+`, la acción `Registrar entrenamiento` debe mostrar un menú intermedio. El menú debe ofrecer un chip para registrar un entrenamiento ya hecho de forma rápida, en 2-3 toques, además de una opción para iniciar un registro nuevo desde cero.

## Cambios realizados

### `apps/frontend/store/useUIStore.ts`

Se añadió el estado global `isLogWorkoutMenuOpen` y sus acciones de apertura/cierre para controlar el nuevo menú de registro sin afectar los demás puntos de entrada al formulario.

### `apps/frontend/components/LogWorkoutModal.tsx`

Se añadió la prop opcional `quickLog`. Cuando está activa, el formulario comienza directamente en el paso de detalles, evitando la selección inicial de entorno para el flujo rápido.

### `apps/frontend/components/LogWorkoutMenu.tsx`

Se creó el nuevo bottom sheet con las opciones `Registrar uno ya hecho` y `Nuevo entrenamiento`, junto con cierre por botón, Escape, overlay y gesto de arrastre.

### `apps/frontend/components/Layout.tsx`

Se añadió la carga dinámica y renderizado del nuevo menú. La acción `Registrar entrenamiento` de `QuickActionsSheet` ahora abre este menú; la opción `Nuevo entrenamiento` conserva el flujo completo y `Registrar uno ya hecho` abre `LogWorkoutModal` con `quickLog` activo.

### `apps/frontend/app/fitness/page.tsx`

Se adaptó el callback del botón existente de actividad pasada para invocar explícitamente `openLogWorkoutModal()` después de convertir la acción global en una función con parámetro opcional.

### `apps/frontend/tests/mobile-responsive.spec.ts`

Se amplió la prueba responsive para verificar que `Registrar entrenamiento` abre el menú intermedio, que el chip `Registrar uno ya hecho` está disponible y que `Nuevo entrenamiento` cierra el menú para mostrar el primer paso `¿Dónde entrenaste?`.

## Corrección posterior

Se detectó que `Nuevo entrenamiento` podía dejar visible el sheet intermedio porque `isLogWorkoutMenuOpen` y `isLogWorkoutModalOpen` se gestionaban de forma independiente. La apertura del modal se ajusta para cerrar siempre el menú y establecer explícitamente si el flujo es rápido o completo.

## Cierre

El flujo queda dividido según la intención del usuario: el botón `+` abre primero las acciones rápidas; `Registrar entrenamiento` abre `LogWorkoutMenu`; `Nuevo entrenamiento` lleva al selector de entorno original; `Registrar uno ya hecho` abre `LogWorkoutModal` directamente en detalles, reduciendo el registro a seleccionar actividad, duración/intensidad y guardar. Las entradas existentes desde Fitness, Nutrition y Perfil mantienen el formulario original y no se alteran.

## Validación

- `npx tsc --noEmit`: correcto.
- `npm run lint`: mantiene errores preexistentes en `Layout.tsx`, `MealPhotoAnalyzer.tsx` y `ShareProgressModal.tsx`; no corresponden a esta tarea.
