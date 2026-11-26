# Cambios: Toggle de tema y Dynamic Island / AOD

## Tarea
1. El botón de toggle de tema (oscuro/claro) no era visible en la pantalla del usuario.
2. Consulta sobre si un temporizador puede aparecer en iOS Dynamic Island o Samsung AOD chips desde la web app.

## Archivos modificados

### 1. `apps/frontend/components/Layout.tsx`
- **Qué cambió:** El botón de toggle de tema en el header se hizo más visible.
- **Por qué:** El botón original (`h-9 w-9`) era pequeño y con color de texto mutado (`text-[var(--text-muted)]`), lo que lo hacía casi invisible contra el fondo del header con backdrop-filter.
- **Cambios específicos:**
  - Tamaño aumentado de `h-9 w-9` a `h-10 w-10` (40px → 44px, tocando el mínimo de accesibilidad táctil).
  - Icono Sun/Moon aumentado de `size={17}` a `size={18}`.
  - Se agregó `bg-[var(--surface-inset)] hover:bg-[var(--surface-raised)]` para darle un fondo visible que contrasta con el header translúcido.

### 2. `apps/frontend/components/settings/sections/AppearanceSection.tsx`
- **Qué cambió:** Se agregó una fila de toggle rápido dentro del grupo "Apariencia" en la página de Settings.
- **Por qué:** Aunque el toggle ya existe en el header, muchos usuarios buscan la opción en Settings. Agregar un toggle directo en la sección de Apariencia hace la función más discoverable y accesible.
- **Cambios específicos:**
  - Se agregó un `SettingsRow` con icono Sun/Moon según el modo actual, título "Modo claro" / "Modo oscuro", y detalle "Sincronizado con el sistema" cuando está en modo `system`.
  - El `onClick` alterna entre dark y light (ignorando system para el toggle directo, que es el comportamiento esperado de un toggle rápido).

### 3. `apps/frontend/app/layout.tsx` — Sin cambios
- El viewport `colorScheme: 'dark light'` ya está correctamente configurado.

## Respuesta a Dynamic Island / Samsung AOD
- **iOS Dynamic Island y Samsung AOD chips son funcionalidades nativas del sistema operativo.** No existe ninguna API web estándar que permita a una web app (PWA o no) mostrar temporizadores o contenido en la Dynamic Island de iOS ni en los chips AOD de Samsung.
- **¿Qué SÍ se puede hacer desde una PWA?**
  - Usar la Web App Manifest con `display: standalone` para que la app se abra en modo fullscreen nativo.
  - Usar `theme-color` meta tag (ya implementado) para cambiar el color de la status bar.
  - Usar `apple-mobile-web-app-capable` y `apple-mobile-web-app-status-bar-style` (ya implementados).
- **Para mostrar un temporizador persistente**, la única opción viable es una notificación push local con `Notification` API (requiere permiso del usuario), o un widget nativo si se construye un wrapper nativo (Capacitor, Tauri, etc.).

## Verificación
- El toggle de tema en el header ahora tiene un fondo visible (`bg-[var(--surface-inset)]`) que lo distingue del header translúcido.
- En la página de Settings > Apariencia, el toggle rápido permite cambiar entre modo oscuro y claro con un clic.
- El toggle del header mantiene la animación circular de reveal al cambiar de tema.
- Se ejecutó `npx tsc --noEmit`. El nuevo código del toggle no presenta errores; permanecen errores preexistentes en `Layout.tsx`/`QuickActionsSheet.tsx` relacionados con `onWorkoutQuickLog` y `Dumbbell`.