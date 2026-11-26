# iOS-like Animations — 75 Days Challenge Frontend

## Tarea General
Añadir animaciones iOS-nativas a toda la app frontend del 75 Days Challenge, siguiendo la filosofía de Emil Kowalski y las guías de `ios-mobile-craft`. El objetivo es que la app se sienta como una aplicación nativa de iOS: transiciones fluidas, física de resorte, consistencia espacial y micro-interacciones precisas.

## Secuencia de Construcción (animate skill)
1. **Frecuencia gate** → decidir si animar o no
2. **Naming de propósito** → feedback, spatial consistency, state indication, etc.
3. **Selección de herramienta** → CSS transitions / Motion / CSS animations / WAAPI
4. **Propiedades** → transform + opacity únicamente
5. **Easing/duración** → usar tokens existentes del proyecto
6. **Interrupción y salida** → caminos simétricos, transiciones no keyframes para elementos rápidos
7. **Reduced motion y hover gating** → incluir con cada animación

## Decisones Clave
- Usar `motion` v12 (importado desde `motion/react`), NO framer-motion
- Usar `tw-animate-css` v1.4.0 para utilidades de entrada (animate-in, fade-in, slide-in-from-*)
- Extender tokens existentes en `globals.css` (lines 2658–2684), no crear un sistema paralelo
- `MotionConfig reducedMotion="user"` ya envuelve la app en `Layout.tsx`
- View Transitions API ya usado para cambio de tema (circular reveal en `themeTransition.ts`)
- Auth screens (login/register) tienen su propio sistema de transiciones (`authTransition.ts`) — preservar y extender
- Los spring physics compartidos viven en `lib/motion/sheetPhysics.ts`
- CSS custom properties para tokens de animación ya existen en `globals.css`

## Inventario de Animation Targets

### ✅ Ya Animados
| Componente | Animación existente |
|---|---|
| SettingsSheet | Sheet enter/exit springs, backdrop fade, drag dismiss |
| QuickActionsSheet | Sheet enter/exit springs, backdrop fade |
| PlansModal | Sheet enter/exit springs, backdrop fade |
| SideQuestsModal | Sheet enter/exit springs, backdrop fade |
| Theme toggle (Layout.tsx) | Circular reveal via View Transitions API |
| Theme toggle icon | Rotate + scale transition |
| Header nav links | `transition-colors` hover |
| Bottom nav links | `active:scale-95` press feedback |
| FAB (FloatingActionButton) | `active:scale-95` press |
| ActiveWorkoutBanner | `active:scale-[0.98]` press |
| IOSSwitch | Track color + thumb translate transition |
| SegmentedControl | Pill indicator translate transition |
| SettingsRow (clickable) | `hover:bg-[var(--surface-inset)]` transition |
| Auth card entrance | `auth-card-in`, `auth-rise` keyframes |
| Auth page transitions | `auth-slide-in-from-right/left` |
| Dashboard (tw-animate-css) | `animate-in`, `fade-in`, `slide-in-from-*` |
| Skeleton shimmer | CSS animation |
| Checkbox draw | CSS animation |
| Calendar sheet | Spring animations |

### ❌ Faltantes (por implementar)
| Componente / Área | Propósito | Herramienta planeada |
|---|---|---|
| **Page transitions** (cambio de ruta) | Spatial consistency — mostrar de dónde viene la página | View Transitions API (CSS) |
| **Bottom-nav tab transitions** | Spatial consistency — indicator slide + content crossfade | Motion (spring) + CSS |
| **Card entrance animations** | State indication — cards appear with stagger | CSS `@starting-style` + stagger |
| **Modal/dialog transitions** | Spatial consistency — scale + fade entrance | Motion (spring) |
| **Toast animations** (StackedToaster) | Feedback — enter/exit with slide + fade | Motion (existing, may need polish) |
| **Scroll-triggered reveals** | State indication — elements fade in on scroll | CSS `@starting-style` + IntersectionObserver |
| **Staggered list reveals** | Spatial consistency — list items stagger in | CSS animation with `--stagger` delay |
| **Button micro-interactions** | Feedback — press, hover, focus rings | CSS transitions |
| **Link transitions** | Feedback — underline/slide on hover | CSS transitions |
| **Bottom nav icon transitions** | Feedback — icon scale + color on active | CSS transitions |
| **Header countdown timer** | State indication — number flip animation | CSS transition |
| **LiveWorkoutOverlay entrance** | Spatial consistency — slide up from bottom | Motion (spring) |
| **RouteBootSkeleton** | Prevent jarring change — fade in content | CSS animation |
| **AuthShell entrance** | Spatial consistency — card rise + backdrop | Motion (preserve existing) |
| **ProfileSection accordion** | State indication — chevron rotate + panel expand | CSS transition |
| **ProfileHeader avatar/banner** | Feedback — press scale on avatar | CSS transition |
| **DayCell calendar interactions** | Feedback — press scale, status change | CSS transition |
| **FloatingActionButton** | Feedback — spring press, ripple | Motion (spring) |
| **SettingsRow hover** | Feedback — subtle background shift | CSS transition (exists, may enhance) |
| **LogoutConfirmSheet** | Spatial consistency — scale + fade | Motion (spring) |
| **ImageCropperModal** | Spatial consistency — fade + scale | Motion (spring) |
| **ProfileEditMenu** | Spatial consistency — slide + fade | Motion (spring) |
| **AchievementsSheet** | Spatial consistency — slide up | Motion (spring) |
| **ActivitiesSheet** | Spatial consistency — slide up | Motion (spring) |
| **MealRecommendationsSheet** | Spatial consistency — slide up | Motion (spring) |
| **MealRoutineBuilderSheet** | Spatial consistency — slide up | Motion (spring) |
| **ExerciseDetailSheet** | Spatial consistency — slide up | Motion (spring) |
| **ExerciseCatalogBrowser** | State indication — card stagger | CSS animation + stagger |
| **CustomExerciseSheet** | Spatial consistency — slide up | Motion (spring) |
| **WorkoutSessionDetailSheet** | Spatial consistency — slide up | Motion (spring) |
| **RoutineBuilderSheet** | Spatial consistency — slide up | Motion (spring) |
| **RestTimerPill** | State indication — pulse on active | CSS animation |
| **WorkoutHudHeader** | State indication — subtle pulse on active | CSS animation |
| **CardioLiveView** | State indication — live indicator pulse | CSS animation |
| **ActiveExerciseCard** | Feedback — press scale | CSS transition |
| **LogWorkoutMenu** | Spatial consistency — slide + fade | Motion (spring) |
| **LogWorkoutModal** | Spatial consistency — scale + fade | Motion (spring) |
| **LogMealModal** | Spatial consistency — scale + fade | Motion (spring) |
| **LogWeightModal** | Spatial consistency — scale + fade | Motion (spring) |
| **ShareProgressModal** | Spatial consistency — scale + fade | Motion (spring) |
| **MealsPlanCard** | Feedback — press scale | CSS transition |
| **MealThumbnail** | Feedback — press scale | CSS transition |
| **FoodPhotoGrid** | State indication — stagger entrance | CSS animation + stagger |
| **OnboardingTutorial** | Spatial consistency — page transitions | Motion (spring) |
| **AIThinkingStatus** | State indication — typing indicator pulse | CSS animation |
| **VoiceOrb** | State indication — pulse animation | CSS animation |
| **VerticalWheelPicker** | Feedback — snap animation | Motion (spring) |
| **RulerPicker** | Feedback — snap animation | Motion (spring) |
| **CustomTaskEditorSheet** | Spatial consistency — slide up | Motion (spring) |
| **AICustomPlanSheet** | Spatial consistency — slide up | Motion (spring) |
| **AISideQuestSheet** | Spatial consistency — slide up | Motion (spring) |
| **AIConversationalStudio** | Spatial consistency — message stagger | CSS animation + stagger |
| **QuickReplyOptionsCard** | Feedback — press scale | CSS transition |
| **VoiceSessionOverlay** | Spatial consistency — fade + scale | Motion (spring) |
| **ProfileHealth** | State indication — value change animation | CSS transition |
| **ProfilePreviewOverlay** | Spatial consistency — fade + scale | Motion (spring) |
| **ProfilePreview** | Spatial consistency — slide up | Motion (spring) |
| **ProfileSkeleton** | Prevent jarring change — shimmer | CSS animation (exists) |
| **LogoutConfirmSheet** | Spatial consistency — scale + fade | Motion (spring) |
| **ProfileEditMenu** | Spatial consistency — slide + fade | Motion (spring) |
| **AchievementIcon** | Feedback — pop on unlock | CSS animation |
| **Sparkline** | State indication — draw animation | CSS animation |
| **ProgressBar** | State indication — fill animation | CSS transition |
| **DayDetailsSheet** | Spatial consistency — slide up | Motion (spring) |
| **DayDetailsModal** | Spatial consistency — scale + fade | Motion (spring) |
| **SideQuestDetailModal** | Spatial consistency — scale + fade | Motion (spring) |
| **AuthField** | Feedback — focus ring + label transition | CSS transition |
| **PatternBackdrop** | Spatial consistency — fade in | CSS transition |
| **AuthThemeToggle** | Feedback — rotate + scale | CSS transition |
| **PasswordForm** | Feedback — show/hide password transition | CSS transition |
| **NotificationsSection** | State indication — toggle animation | CSS transition |
| **ChallengeMembershipSection** | Spatial consistency — slide in | Motion (spring) |
| **AppearanceSection** | State indication — toggle animation | CSS transition |
| **ProfileForm** | Feedback — field focus transition | CSS transition |
| **ProfileHeroCard** | Spatial consistency — fade + slide up | Motion (spring) |

## Tokens de Animación Existentes (globals.css lines 2658–2684)
```css
--duration-stagger: 60ms;
--duration-micro: 100ms;
--duration-quick: 150ms;
--duration-fast: 200ms;
--duration-medium: 300ms;
--duration-slow: 500ms;
--ease-smooth-out: cubic-bezier(0.23, 1, 0.32, 1);
```

## Easing Constants Existentes
- `--ease-out`: `cubic-bezier(0.23, 1, 0.32, 1)` — fuerte ease-out para UI
- `--ease-in-out`: `cubic-bezier(0.77, 0, 0.175, 1)` — fuerte ease-in-out
- `--ease-drawer`: `cubic-bezier(0.32, 0.72, 0, 1)` — iOS-like drawer curve (Ionic)
- Sheet physics: `SHEET_ENTER_SPRING` (spring, bounce 0, duration 0.4), `SHEET_EXIT_TRANSITION` (0.22s, ease [0.32, 0.72, 0, 1])

## Plan de Implementación por Fases

### Fase 1: Page Transitions + Bottom Nav (alta prioridad, mayor impacto)
1. Page transitions usando View Transitions API
2. Bottom nav tab indicator animation + content crossfade
3. Header nav link transitions

### Fase 2: Card Entrances + Staggered Lists
4. Card entrance animations with stagger
5. Scroll-triggered reveals (IntersectionObserver + CSS)
6. List stagger animations

### Fase 3: Micro-interactions + Feedback
7. Button press micro-interactions (spring scale)
8. Link hover transitions
9. Bottom nav icon transitions
10. Header countdown timer number flip

### Fase 4: Sheet/Modal Polish
11. All sheet/modal entrance polish (spring + backdrop)
12. LogoutConfirmSheet animation
13. ImageCropperModal animation
14. ProfileEditMenu animation

### Fase 5: Component-Specific Animations
15. ProfileSection accordion animation
16. ProfileHeader avatar/banner press feedback
17. DayCell calendar interactions
18. FAB spring press + ripple
19. Toast enter/exit polish
20. Skeleton shimmer polish

### Fase 6: Remaining Components
21. All remaining sheets modals
22. Settings component animations
23. Onboarding component animations
24. Fitness component animations
25. Nutrition component animations

## Archivos a Crear/Modificar
- `apps/frontend/components/Layout.tsx` — page transitions, bottom nav animation
- `apps/frontend/lib/pageTransitions.ts` — nuevo: View Transitions API helper
- `apps/frontend/lib/bottomNavTransitions.ts` — nuevo: bottom nav indicator animation
- `apps/frontend/components/...` — individual component updates
- `apps/frontend/app/globals.css` — nuevos keyframes si necesarios

## Notas Técnicas
- Motion v12 se importa como `from 'motion/react'`
- `tw-animate-css` v1.4.0 utilities: `animate-in`, `fade-in`, `slide-in-from-*`, `zoom-in`, `zoom-out`
- CSS `@starting-style` para entradas sin JS state
- `prefers-reduced-motion` ya cubierto globalmente via `MotionConfig reducedMotion="user"`
- `hover: ` media query gating para elementos que no son touch
- Todos los spring configs deben usar los de `sheetPhysics.ts` o derivarlos de ahí
- No inventar easings — usar los del proyecto o de easing.dev

## Restricciones
- No usar `transition: all` — nombrar propiedades exactas
- No usar `scale(0)` — usar `scale(0.95)` + `opacity: 0`
- No usar `ease-in` en UI — usar `ease-out` o custom curve
- Duraciones UI < 300ms
- No animar en keyboard shortcuts o acciones 100+/día
- No animar datos que el usuario está leyendo o manipulando
- `transform-origin` en el trigger para popovers/dropdowns (modals exempt)
- No usar CSS variables del padre para drivear transform de hijos

## Registro incremental de cambios

### Archivo: `apps/frontend/lib/pageTransitions.ts`
- Se creó un helper de navegación con View Transitions API para añadir continuidad espacial entre rutas principales.
- Incluye fallback a `router.push` cuando View Transitions no está disponible o el usuario prefiere movimiento reducido.
- Expone una dirección (`forward`/`backward`) para que CSS pueda diferenciar el sentido del cambio sin acoplar la lógica de navegación a cada enlace.
- La limpieza de `data-page-nav` se realiza al finalizar la transición, evitando estado visual persistente si la navegación termina o falla.

### Archivo: `apps/frontend/components/Layout.tsx` (parte 1)
- Se conectaron los enlaces principales del header a `navigateWithPageTransition`, conservando navegación nativa para modificadores de teclado y respetando reduced motion.
- La dirección de navegación se calcula desde la ruta actual para habilitar una transición espacial consistente.
- También se conectaron los accesos móviles de calendario/ajustes y los cuatro destinos del bottom navigation al mismo helper, evitando que cada superficie tenga una física de navegación distinta.
- Se añadió un indicador inferior compartido con `layoutId="bottom-nav-active"`; Motion lo desplaza entre pestañas con un spring corto, sin animar layout ni contenido legible.

### Archivo: `apps/frontend/app/globals.css`
- Se añadieron animaciones de snapshot para las transiciones de ruta: fade de salida y entrada con desplazamiento horizontal de 10px, usando el token `--ease-smooth-out` y una duración de 220ms.
- La dirección inversa usa el desplazamiento opuesto mediante `data-page-nav="backward"`.
- Los selectores quedaron scoped a `html[data-page-nav]` para no interferir con el snapshot `root` que ya usa el reveal circular del cambio de tema.
- El bloque de reduced motion elimina el desplazamiento y reduce la duración a 120ms, preservando únicamente la continuidad visual mínima.

### Corrección posterior: `apps/frontend/components/Layout.tsx`
- Se movieron los dos `useCallback` de navegación antes de los retornos tempranos de las pantallas públicas/no autenticadas.
- Esto mantiene el orden de hooks estable en todas las rutas, sin alterar el comportamiento de la transición.

### Corrección: `apps/frontend/lib/pageTransitions.ts`
- Se corrigió la invocación de `startViewTransition` usando `startViewTransition.call(document, ...)`.
- Safari/Chromium requieren que el método Web IDL conserve `document` como receptor; extraerlo y llamarlo directamente provocaba el `TypeError` reportado.

### Archivo: `apps/frontend/app/globals.css` (entradas escalonadas)
- Se creó `.ios-stagger` para entradas predeterminadas de listas usando solamente `opacity` y `translateY(8px)`.
- El intervalo usa el token existente `--duration-stagger` de 40ms y la curva `--ease-smooth-out`.
- Se limitaron los índices explícitos al primer bloque de ocho elementos para evitar una cascada excesiva en listas largas.
- En reduced motion se elimina el desplazamiento y se conserva únicamente un fade breve sin delays.

## Cierre global
- `apps/frontend/lib/pageTransitions.ts` centraliza la navegación animada, el fallback y la dirección espacial.
- `apps/frontend/components/Layout.tsx` aplica el helper a la navegación desktop/mobile y añade el indicador activo compartido del bottom nav con Motion spring.
- `apps/frontend/app/dashboard/page.tsx` aplica `.ios-stagger` a los bloques de metas, tareas base, metas personalizadas y objetivos periódicos para que la entrada de listas no ocurra toda en un único frame.
- `apps/frontend/app/globals.css` define la animación de snapshots de ruta y su variante reduced motion, aislada de la transición de tema existente.
- `docs/cambios-animations-ios-like.md` mantiene la trazabilidad incremental y el inventario de las siguientes fases de animación.
- La interacción es deliberadamente pequeña: el router decide el destino, el helper decide si puede animarse, Motion mueve únicamente el indicador activo y CSS anima los snapshots; así se conserva la accesibilidad y se evita animar el contenido que el usuario está leyendo.

## Verificación
- `npx eslint components/Layout.tsx lib/pageTransitions.ts`: correcto.
- `npm run lint`: continúa reportando errores preexistentes en `MealPhotoAnalyzer.tsx` y `ShareProgressModal.tsx`; no quedan errores de hook en `Layout.tsx`.
- `npx tsc --noEmit`: continúa bloqueado por errores preexistentes de sintaxis/tipos en `components/fitness/ExerciseCatalogBrowser.tsx`.
- `git diff --check`: correcto.
