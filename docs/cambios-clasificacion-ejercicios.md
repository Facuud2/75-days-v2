# Cambios: Clasificación de Ejercicios por Ambiente + UX Mobile + Transiciones Apple

## Tarea General
Corregir la lógica de clasificación de ejercicios por entorno (En casa / Gimnasio / Outdoor) para que las tres categorías sean mutuamente exclusivas y correctamente delimitadas, y aplicar mejoras de UX mobile-native y transiciones Apple-style al UI de filtros.

## Archivos Modificados

### 1. `apps/frontend/lib/api/exerciseCatalog.ts`
**Qué se cambió:**
- Expandió `HOME_EQUIPMENT_KEYS` para incluir `kettlebells` y `dumbbell` (equipo doméstico común que faltaba)
- Agregó `GYM_EQUIPMENT_KEYS` constante con `machine`, `cable`, `barbell`, `e-z curl bar`
- Reemplazó `OUTDOOR_CARDIO_IDS` (lista hardcodeada de 3 IDs) por lógica basada en reglas: `category === 'cardio' && equipment !== 'machine'`
- Reescribió `matchesExerciseEnvironment` con lógica de 4 pasos mutuamente exclusivos evaluados en orden:
  1. **OUTDOOR** (evaluado primero): `category === 'cardio' && equipment !== 'machine'` — running, cycling, skating, rope jumping, prowler sprints, etc.
  2. **GYM**: equipo en `GYM_EQUIPMENT_KEYS` O (`other` en categorías strongman/powerlifting/olympic weightlifting) O cardio con `machine`
  3. **HOME**: equipo en `HOME_EQUIPMENT_KEYS` O `other` equipment que NO es gym-specific
  4. **FALLBACK**: todo lo restante → home (stretching, plyometrics sin equipo especial)

**Resultado verificado (876 ejercicios totales):**
- Home (En casa): 521 — incluye dumbbells (123), kettlebells (56), bodyweight, bands, etc.
- Outdoor: 5 — Trail Running, Ciclismo, Prowler Sprint, Rope Jumping, Skating
- Gym (Gimnasio): 350 — barbell (170), cable (81), machine (67), e-z curl bar (9)
- Zero overlaps entre las tres categorías

### 2. `apps/frontend/components/fitness/ExerciseCatalogBrowser.tsx`
**Qué se cambió:**
- Agregó la opción `outdoor` al selector de ambiente (pills de filtro) con ícono `Tent` de lucide-react
- Agregó `Home` y `Dumbbell` icons para las pills de `home` y `gym` respectivamente
- Importó `motion`, `AnimatePresence`, `useReducedMotion` de `motion/react`
- **Mobile-native fixes:**
  - `touch-action: manipulation` en todos los botones de filtro (evita delay de 300ms en mobile)
  - `overscroll-behavior: contain` en contenedores de chips (previene scroll hijacking)
  - `min-h-[44px]` min touch targets en todos los botones interactivos
  - `active:scale-95` press feedback en pills y chips
  - `select-none` para prevenir selección de texto en botones
- **Apple-style transitions:**
  - `AnimatePresence mode="wait"` con crossfade animation cuando cambia el ambiente seleccionado
  - `motion.div` con `initial`/`animate`/`exit` para loading, error, empty y list states
  - Spring-based ease `[0.25, 0.46, 0.45, 0.94]` para la transición de la lista
  - `useReducedMotion` hook para deshabilitar animaciones cuando el usuario prefiere reduced motion
- **Equipment filter refinement:** cuando `outdoor` está seleccionado, solo muestra `all`, `none` chips (sin equipo de gimnasio)
- **Visual polish:** inline styles para active/pressed states con border color, background, box-shadow y indicator dot

### 3. `apps/frontend/lib/constants/fitness.ts`
**Qué se cambió:**
- Sin cambios directos en este archivo; las constantes de equipment/chips ya existen y son usadas por la lógica actualizada

## Relación entre archivos
- `exerciseCatalog.ts` define la lógica de clasificación que `ExerciseCatalogBrowser.tsx` consume via `filterExercises()` y `matchesExerciseEnvironment()`
- El componente usa `HOME_EQUIPMENT_KEYS` para filtrar el panel de equipamiento cuando el ambiente es "home"
- Los cambios en la lógica de clasificación se reflejan automáticamente en el contador de resultados y la lista filtrada
- El `filterExercises` function (line 234-235) no requirió cambios — solo llama a `matchesExerciseEnvironment` cuya firma no cambió

## Motivación técnica
- La lógica anterior usaba `HOME_EQUIPMENT_KEYS` demasiado estrecho (sin kettlebells/dumbbells) y un fallback `gym` que atrapaba 624 ejercicios incluyendo bodyweight y estiramientos
- `OUTDOOR_CARDIO_IDS` solo tenía 3 IDs hardcodeados, perdiendo la mayoría de cardio outdoor (solo Trail Running, Cycling, Skating)
- El UI de filtros carecía de feedback táctil y transiciones fluidas propias de una app nativa
- La clasificación no era mutuamente exclusiva: un ejercicio podía aparecer en "home" y "gym" simultáneamente

## Verificación
- TypeScript compilation: `npx tsc --noEmit` pasa sin errores
- Clasificación mutuamente exclusiva verificada con Python: Home=521, Outdoor=5, Gym=350, total=876, zero overlaps
- `filterExercises` export sin cambios — funciona correctamente con la nueva lógica
