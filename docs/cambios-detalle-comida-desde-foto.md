# Cambio: detalle de comida desde la foto

## Solicitud
Al pulsar sobre la foto o miniatura de una comida en la pantalla de Nutrición, mostrar la información correspondiente de esa comida.

## Registro incremental

### `apps/frontend/components/FoodPhotoGrid.tsx`
- Se actualizó el componente para recibir objetos `Meal` completos.
- Se añadió la prop opcional `onMealPress`.
- Cada miniatura ahora se renderiza dentro de un botón accesible, con etiqueta `Ver detalles de ...`, estados de foco y feedback de pulsación.
- El componente conserva el comportamiento decorativo cuando no se proporciona `onMealPress`.

### `apps/frontend/app/nutrition/page.tsx`
- Se conectó `FoodPhotoGrid` con el estado `editingMeal`.
- Al pulsar una miniatura, se selecciona la comida correspondiente y se abre el `EditMealModal` ya existente, que muestra calorías, macros, fibra, azúcares, tipo de comida y permite editar o eliminar el registro.
- Se mantuvo el límite existente de tres miniaturas visibles para no modificar el diseño actual de la pantalla.

### Limpieza
- Se eliminó el archivo auxiliar temporal `apps/frontend/public/meal-photo-preview.jpeg`, usado únicamente durante la revisión de la referencia visual.

## Cierre
La interacción reutiliza el modal de edición existente en lugar de duplicar la lógica nutricional. `FoodPhotoGrid` comunica la comida seleccionada mediante `onMealPress`; `NutritionPage` actualiza `editingMeal`; y `EditMealModal` presenta la información y las acciones del registro seleccionado. El flujo funciona tanto con fotos cargadas como con las miniaturas visuales de respaldo por tipo de comida.
