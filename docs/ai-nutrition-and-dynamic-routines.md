# Nutrición con IA (Estilo BitePal) y Planificador Dinámico de Rutinas

> **Última actualización:** 2026-11-24  
> **Estado:** Fase 1 implementada y lista para prueba · Fase 2 especificada y lista para iniciar tras validación de Fase 1.

---

## Contexto y Visión de Centralización

El objetivo de estas dos fases es centralizar en **75 Days App V2** la carga inteligente de comidas y la planificación dinámica de entrenamientos sin obligar al usuario a saltar entre aplicaciones externas (como BitePal/CalAI o Hevy/Fitbod), manteniendo fricción mínima en dispositivos móviles.

---

## Fase 1 — Registro de Comidas con IA (Estilo BitePal) ✅ Implementada

### Decisiones de Producto y UX Aplicadas
1. **Apertura directa en Visor de Cámara (`Escáner IA`)**:
   - Al abrir `LogMealModal`, el usuario entra directamente al visor en vivo estilo BitePal (`facingMode: { ideal: 'environment' }`), con fallback automático y transparente a cámara nativa (`capture="environment"`) o galería si el navegador/dispositivo no expone `getUserMedia`.
   - El selector superior permite cambiar en cualquier momento a `Buscador` o `Mis Comidas`.
   - El momento del día (`Desayuno`, `Almuerzo`, `Snack`, `Cena`) se preselecciona automáticamente según la hora local del dispositivo.
2. **Botón de Teclado (`Describir con teclado`) + Voz**:
   - Desde la barra inferior de cámara (`Galería` · `Obturador` · `Teclado`), el usuario puede describir con texto o dictado de voz (`useVoiceRecorder` + `/api/ai/transcribe`) qué comió o bebió sin necesidad de tomar foto.
3. **Barra adicional `"Corregir o ajustar con IA"`**:
   - En la vista de resultados (`REVIEW`), el usuario cuenta con una barra dedicada para pedir correcciones por texto o voz sobre el análisis actual (ej. *"Es merluza, no pollo, y sin salsa"*), enviando el contexto del plato e imagen a Gemini para recalcular sin perder los ítems aprobados.
4. **Control Manual Directo y Diseño iOS Nativo (`375×812px` Anti-Bloat)**:
   - Sin multiplicadores innecesarios ni cajas anidadas: una sola fila KPI (`kcal` + `Prot / Carbs / Grasas` con tokens semánticos legibles en modo claro y oscuro) y una **lista agrupada estilo iOS (`divide-y`)** inmediatamente visible arriba del pliegue.
   - Al pasar a `REVIEW` o `TEXT_INPUT`, se ocultan las pestañas superiores de `LogMealModal` para dedicar todo el alto disponible al plato e ingredientes.
   - Todos los campos de texto (`AutoGrowTextarea` con `16px` mínimo en punteros táctiles para evitar auto-zoom de Safari iOS) se expanden automáticamente con saltos de línea y texto largo.
   - Al tocar cualquier ingrediente se despliega la edición manual directa y limpia (nombre, gramos con reescalado proporcional o kcal/macros exactos a mano), más fila final `+ Agregar ingrediente` (manual o catálogo) y compositor compacto de corrección con IA estilo iMessage.
   - Guardado optimista a 0ms mediante `useHealthStore.logMealOptimistic`.
5. **Paquete de Precisión Bromatológica (USDA Atwater + Catálogo DB + Sin Deriva de Redondeo + Fibra y Azúcares)**:
   - **Precisión flotante interna (`mealMath.ts`)**: cada ítem preserva sus valores sin redondear y su `baseDensity` exacta por gramo (`attachBaseDensity`), redondeando únicamente en el borde visual/guardado (`computeMealTotals`, `roundMacro`) para eliminar derivas tras múltiples ediciones de gramos.
   - **Anclaje al Catálogo Local + USDA FoodData Central (`geminiService.ts` + `aiController.ts`)**: `analyzeMeal` inyecta en memoria los ingredientes canónicos de `Ingredient` (`fetchCachedSystemIngredients`) como prioridad #1 y fija **USDA FoodData Central (Foundation / SR Legacy)** con factores de Atwater específicos como fuente consistente #2, exigiendo siempre **peso neto comestible** (sin cáscara/hueso/carozo) y estado explícito (*cocido* vs. *crudo*).
   - **Fibra y Azúcares con revelación progresiva (`health.schema.prisma` + UI)**: agregadas columnas aditivas `fiberG` y `sugarG` (`Float @default(0)`) en `MealEntry`; se reportan sin alterar `carbG` (carbohidratos totales) y se muestran de forma sutil en una sola línea secundaria únicamente cuando son `> 0`, manteniendo intactas las 3 columnas principales (`Prot · Carbs · Grasas`).
6. **Sección Dedicada `/nutrition` y Resumen en `Calendario`**:
   - Barra inferior móvil actualizada a `Inicio · Nutrición · + · Fitness · Perfil` (`Layout.tsx`), con acceso directo a `Calendario` desde el header y desde `Inicio` (`/dashboard`).
   - Nueva página `/nutrition` (`apps/frontend/app/nutrition/page.tsx`) con selector de fechas, editor de metas nutricionales y los 4 bloques agrupados (`Desayuno · Almuerzo · Snack · Cena`), más visualización de comidas por fecha dentro de `DayDetailsSheet.tsx` en `/calendar`.

### Archivos Creados / Modificados en Fase 1
- `apps/frontend/lib/utils/image.ts`: `compressImageForAI` y `captureVideoFrameForAI` (compresión cliente a JPEG `max 1024px`, `q=0.80`, ~150–250 KB, corrigiendo orientación EXIF con `createImageBitmap`).
- `apps/frontend/lib/utils/mealMath.ts`: `computeMealTotals` y `scaleMealItemByGrams` (cálculo determinista libre de derivas de punto flotante).
- `apps/frontend/lib/server/services/geminiService.ts`: `analyzeMealInput` sobre `ai.interactions.create` (`model: 'gemini-4-hydrogen'`) con JSON Schema estricto y validación Zod (`aiMealRawResponseSchema`), soportando foto multimodal, descripción por teclado y corrección contextual, más rechazo limpio (`isFood: false`) sin alucinaciones.
- `apps/frontend/lib/server/controllers/core/aiController.ts`: controlador `analyzeMeal` y esquema `analyzeMealRequestSchema`.
- `apps/frontend/app/api/ai/analyze-meal/route.ts`: endpoint `POST /api/ai/analyze-meal` con `{ auth: true, rateLimit: 'ai' }`.
- `apps/frontend/lib/api/ai.ts`: método `aiService.analyzeMeal` y contratos TypeScript.
- `apps/frontend/components/MealPhotoAnalyzer.tsx`: flujo móvil completo en 4 etapas (`CAMERA`, `TEXT_INPUT`, `ANALYZING`, `REVIEW`) con limpieza garantizada de `MediaStream` y `AbortController`.
- `apps/frontend/components/LogMealModal.tsx`: apertura por defecto en `AI` (`Escáner IA`) preservando orden accesible del DOM y flujos previos (`Buscador`, `Mis Comidas`).
- `apps/frontend/tests/meal-ai-analysis.test.ts`: pruebas unitarias (Vitest) de matemática nutricional, esquemas Zod y los 3 modos de Gemini + casos borde.
- `apps/frontend/tests/meal-ai-bitepal.spec.ts`: prueba E2E móvil (`360×740`, Playwright) cubriendo cámara BitePal, teclado, barra de corrección IA, agregado manual de ingredientes, cero overflow horizontal y guardado optimista.

---

## Fase 2 — Planificador Dinámico de Rutinas en `/fitness` 🔜 Próxima Etapa

Esta especificación recoge exactamente las reglas acordadas para continuar apenas se valide la Fase 1.

### Reglas de Negocio y Comportamiento IA Acordadas
1. **Orden Secuencial cuando no se especifica horario**:
   - Si el usuario menciona actividades o ejercicios sin indicar día/turno exacto, la IA los coloca **uno debajo del otro (`order: 0, 1, 2...`) en el mismo orden en que aparecen en el mensaje del usuario**.
2. **Estructura Inteligente cuando el usuario da horarios o días**:
   - Si el usuario especifica estructura temporal (ej. *"lunes por la mañana caminata y por la tarde brazos; martes piernas por la mañana y por la tarde caminata"*), la IA preserva tanto el día (`dayOfWeek`) como el turno (`timeOfDay: 'morning' | 'afternoon' | 'evening' | 'any'`) y el orden interno (`order`).
3. **Flexibilidad de Entorno y Nivel de Detalle**:
   - Soporta planes **en casa**, **en gimnasio**, **al aire libre** o **solo por grupos musculares** (ej. *"brazos, piernas, pecho, abdominales"*) sin exigir detallar maquinaria cuando el usuario prefiere mantenerlo general.
4. **Clarificación Calibrada Anti-Alucinación**:
   - La IA no interroga de forma rígida en cada mensaje si ya cuenta con lo suficiente para armar una propuesta fiel.
   - **Sin embargo, cuando detecta huecos críticos o ambigüedades reales que la obligarían a adivinar**, devuelve `status: 'needs_clarification'` con preguntas puntuales y opciones rápidas seleccionables en móvil, evitando inventar ejercicios, equipamiento o estructuras erróneas.
5. **Alineación Automática con el Reto Activo (`Challenge` + `GoalTemplate`)**:
   - El backend inyecta automáticamente las metas del reto activo (ej. cantidad de pasos diarios o minutos de caminata/trote definidos en `Soft`, `Medium`, `Hard` o `Custom`) para que los bloques de cardio/actividad usen esos objetivos reales.
6. **Integración Total con `/fitness` y el Botón Play (`LiveWorkoutOverlay`)**:
   - La vista `/fitness` mostrará `TodayPlanHeroCard` con strip semanal `L–D` y la pila ordenada de bloques del día (mañana/tarde o lista secuencial).
   - Cada bloque de fuerza/rutina o grupo muscular se lanza directamente con el botón **Play** hacia `LiveWorkoutOverlay` (usando ejercicios emparejados contra los 876 ejercicios reales de `exercises.es.json` mediante `exerciseMatcher.ts`, o abriendo el selector pre-filtrado por músculo si es un bloque abierto).
   - Los bloques de caminata/cardio/pasos abren `LogWorkoutModal` precargado con el deporte y la meta correspondiente.

### Plan Técnico Paso a Paso para Fase 2
1. **Esquema Prisma (`apps/frontend/prisma/health.schema.prisma`)**:
   - Agregar `TrainingPlan` (`id`, `userId`, `challengeId?`, `name`, `goalSummary?`, `scheduleType`: `'weekly' | 'sequential' | 'rotation'`, `environment`, `isActive`) y `TrainingPlanSlot` (`id`, `planId`, `dayOfWeek?`, `timeOfDay`: `'morning' | 'afternoon' | 'evening' | 'any'`, `order`, `slotType`: `'routine' | 'focus' | 'cardio' | 'rest'`, `title`, `focusMuscles`, `environment`, `sport`, `targetDurationMin?`, `targetSteps?`, `routineId?`).
2. **Emparejador de Catálogo (`apps/frontend/lib/server/services/exerciseMatcher.ts`)**:
   - Matching determinista contra `public/data/exercises.es.json` respetando entorno (`home` vs `gym`).
3. **IA + API Routes**:
   - `POST /api/ai/workout-plan` (`processWorkoutPlanTurn` en `geminiService.ts`).
   - `GET/POST /api/workouts/plans` y `PATCH/DELETE /api/workouts/plans/[id]` (`trainingPlanController.ts`).
4. **Componentes UI Mobile-First**:
   - `apps/frontend/components/fitness/TodayPlanHeroCard.tsx`
   - `apps/frontend/components/fitness/AiRoutinePlannerSheet.tsx`
   - Integración en `apps/frontend/app/fitness/page.tsx`, `useActiveWorkoutStore.ts`, `LogWorkoutModal.tsx` y resumen diario en `apps/frontend/app/dashboard/page.tsx`.
5. **Tests de Fase 2**:
   - Unit tests de `exerciseMatcher`, orden secuencial/turnos horarios y clarificación calibrada + E2E móvil en `/fitness`.
