# Documentación de Cambios — Mejora de UI del Dashboard

## Tarea General
Mejorar la interfaz del dashboard y la experiencia visual general de la app "75 Days Challenge", que el usuario percibe como "simplona". Se prioriza la jerarquía visual, el uso correcto de tokens semánticos, el efecto frosted glass en el header, y la corrección de problemas mobile-first.

## Cambios Planificados (Priorizados)

### Fase 1: Dashboard Surface Hierarchy (prioridad alta)
- Reemplazar fondos planos `bg-rose-950/20` en cards por tokens semánticos (`--surface-card`, `--surface-inset`)
- Agregar clases `dashboard-card` reutilizables en `globals.css`
- Agregar frosted glass al header (`backdrop-filter: blur(20px) saturate(180%)`)
- Gatear todos los `:hover` con `@media (hover: hover) and (pointer: fine)`
- Corregir contraste de texto mutado (`text-white/45` → `var(--text-muted)`)

### Fase 2: Mobile Chrome Polish
- Agregar `padding-bottom: env(safe-area-inset-bottom)` al bottom nav
- Aumentar tamaño de labels del bottom nav a `text-[11px]` mínimo
- Agregar `backdrop-filter` al header

### Fase 3: Motion & Animation
- Animación de entrada escalonada para items del dashboard
- Animación del anillo de progreso (stroke-dashoffset)
- Feedback de presión consistente en botones

### Fase 4: Landing Page Visual Richness
- Agregar gradiente de fondo al hero
- Mejorar jerarquía tipográfica
- Envolver items de features en cards con borde lateral

## Archivos Modificados
- `apps/frontend/app/globals.css`
- `apps/frontend/app/dashboard/page.tsx`
- `apps/frontend/components/Layout.tsx`
- `apps/frontend/app/page.tsx`

## Estado
- En progreso

### Cambios realizados
- `apps/frontend/app/globals.css`: Agregada clase `.dashboard-card` con tokens semánticos (`--surface-card`, `--border-subtle`, `--surface-card-hover`, `--border-interactive`). Hover gateado con `@media (hover: hover) and (pointer: fine)`. Mejorado `.app-header` con `saturate(180%)` y `border-bottom: 1px solid var(--border-subtle)`.
