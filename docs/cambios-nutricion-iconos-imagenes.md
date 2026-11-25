# Cambios — Nutrición: iconos, miniaturas de comida y tuerca de ajustes

## 🎯 Tarea solicitada
1. Sustituir los emojis de la pantalla de Nutrición por iconos (como el resto del sitio).
2. Arreglar las "imágenes" de las comidas, que se veían como círculos vacíos.
3. Mostrar el icono de tuerca (acceso a Ajustes) únicamente en Perfil.

## Registro incremental de archivos

### `apps/frontend/components/MealThumbnail.tsx` (creado)
- Nuevo componente reutilizable que dibuja la miniatura circular de una comida.
- Sustituye los emojis por iconos de `lucide-react` (`Coffee`, `UtensilsCrossed`, `Apple`, `Moon`, fallback `Utensils`).
- Cada tipo de comida tiene un degradado cálido determinístico + icono blanco, con luz y sombra para que se lea como una foto y no como un círculo vacío.
- `aria-hidden`: es decorativo; el nombre accesible vive en la lista de comidas.
- Motivo: no había URLs de imagen en la API, así que se resuelve con una miniatura visual consistente y sin dependencias de red.

### `apps/frontend/components/FoodPhotoGrid.tsx` (modificado)
- Ahora renderiza `MealThumbnail` (iconos + degradado) en lugar de glifos emoji.
- Devuelve `null` cuando no hay comidas, evitando un contenedor vacío.
- Se mantiene `aria-hidden` porque es decorativo.

### `apps/frontend/components/MealsPlanCard.tsx` (modificado)
- La miniatura de cada comida ahora usa `MealThumbnail` (icono + degradado) en lugar del emoji condicional.
- Motivo: unificar el lenguaje visual con iconos y hacer que la "foto" de la comida se vea siempre.

### `apps/frontend/app/nutrition/page.tsx` (modificado)
- Las 3 columnas de macros ya no usan emojis (`🥩`, `🍞`, `🥑`); ahora usan iconos lucide (`Beef`, `Wheat`, `Droplet`) teñidos con el color de cada macro.
- Se importó `type LucideIcon` para tipar el icono dentro del array de macros.
- Motivo: coherencia con el design system, que emplea iconos vectoriales en toda la app.

### `apps/frontend/components/Layout.tsx` (modificado)
- El enlace móvil "Abrir ajustes" (tuerca) pasó de mostrarse en todas las rutas salvo `/settings` a mostrarse **solo** cuando `pathname === '/profile'`.
- Motivo: el usuario quiere que la tuerca viva únicamente en Perfil; desde ahí se accede a Ajustes.
- Impacto en tests: `tests/mobile-responsive.spec.ts` asumía que la tuerca era visible en `/dashboard`; se actualiza para reflejar la nueva regla (oculta fuera de Perfil, visible en Perfil).

### `apps/frontend/tests/mobile-responsive.spec.ts` (modificado)
- En `/dashboard` ahora se asserta que "Abrir ajustes" está **oculto**.
- Al final del test se navega a `/profile` y se asserta que "Abrir ajustes" está **visible**.
- Motivo: alinear la suite con el nuevo comportamiento de la tuerca.

---

## Cierre

### Resumen de archivos intervenidos
| Archivo | Tipo | Cambio |
|---|---|---|
| `components/MealThumbnail.tsx` | Creado | Miniatura circular con icono lucide + degradado por tipo de comida. |
| `components/FoodPhotoGrid.tsx` | Modificado | Usa `MealThumbnail`; sin emojis; `null` si no hay comidas. |
| `components/MealsPlanCard.tsx` | Modificado | Usa `MealThumbnail` en cada fila; sin emojis. |
| `app/nutrition/page.tsx` | Modificado | Macros con `Beef` / `Wheat` / `Droplet` en lugar de emojis. |
| `components/Layout.tsx` | Modificado | Tuerca de Ajustes solo en `/profile`. |
| `tests/mobile-responsive.spec.ts` | Modificado | Assert de tuerca oculta en dashboard y visible en profile. |

### Relación entre archivos
- `MealThumbnail` es la única fuente de verdad visual de la comida; tanto `FoodPhotoGrid` (resumen superior) como `MealsPlanCard` (lista) lo consumen, garantizando coherencia.
- `page.tsx` orquesta ambas tarjetas y aporta los iconos de macros con el color semántico de cada macro.
- `Layout.tsx` controla la visibilidad de la tuerca a nivel de shell; su test asociado (`mobile-responsive.spec.ts`) valida la regla.

### Motivo técnico
- La API de comidas no expone URLs de imagen; se optó por una miniatura determinística (degradado + icono) en lugar de un `<img>` roto, evitando dependencias de red y manteniendo el lenguaje de iconos del design system.
- La tuerca se condicionó a `/profile` porque el acceso a Ajustes debe partir desde Perfil, reduciendo ruido en el header del resto de pantallas.

### Validación
- `npx tsc --noEmit`: sin errores en los archivos tocados.
- `npx eslint` sobre los archivos tocados: sin errores.
- `playwright test tests/nutrition-section.spec.ts`: ✅ 2/2 (light + dark).
- Verificación visual (capturas): miniaturas de comida visibles y coloridas; tuerca ausente en `/nutrition` y presente en `/profile`.
