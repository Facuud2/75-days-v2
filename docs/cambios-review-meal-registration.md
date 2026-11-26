# Rediseño de la pantalla de revisión de registro de comida

## Tarea
Rediseñar la etapa `REVIEW` de `MealPhotoAnalyzer` para que la entrada desde el análisis se sienta deliberada y comunique claramente que la comida fue identificada y está lista para revisar, manteniendo el sistema visual y los patrones de motion existentes.

## Registro incremental

### Inicio
Se identificaron como archivo principal `apps/frontend/components/MealPhotoAnalyzer.tsx` y como referencia de motion `apps/frontend/lib/motion/sheetPhysics.ts`. La implementación conservará los tokens CSS existentes y respetará `prefers-reduced-motion`.

### `apps/frontend/components/MealPhotoAnalyzer.tsx`
Se añadieron las importaciones de `motion/react` y de los presets de física existentes para poder animar la entrada de `REVIEW` sin introducir una librería ni un sistema de easing paralelo. También se incorporó `CheckCircle2` para representar el estado de registro listo de forma explícita. Se añadió `useReducedMotion` para que la nueva transición tenga una variante accesible.

La etapa `REVIEW` ahora vive dentro de `AnimatePresence` y entra con una transición de opacidad, desplazamiento vertical corto y escala casi imperceptible. Se agregó un encabezado de confirmación “Comida identificada” antes del contenido editable, con una demora mínima para crear un handoff deliberado desde el análisis. La salida también está animada para evitar un corte abrupto al cambiar de etapa.

Se ajustó la ubicación de las importaciones de `motion/react` para mantener los paquetes externos agrupados antes de los alias locales.

## Cierre

### Resumen de archivos modificados
- `apps/frontend/components/MealPhotoAnalyzer.tsx`: entrada y salida animadas de la etapa `REVIEW`, confirmación visual de comida identificada y soporte para reducción de movimiento.
- `docs/cambios-review-meal-registration.md`: documentación incremental y cierre técnico de la tarea.

### Interacción entre archivos
`MealPhotoAnalyzer` consume los presets de `sheetPhysics.ts` y `motion/react` para coordinar el cambio de etapa sin alterar el flujo de guardado ni el contrato con `LogMealModal`. La documentación registra la decisión y el alcance de la intervención.

### Verificación
`git diff --check` no reportó errores. ESLint mantiene un error preexistente en la línea 232 relacionado con una actualización de estado dentro de un efecto de cámara; no fue introducido por este cambio. TypeScript también mantiene errores preexistentes en otras pantallas/componentes del proyecto.
