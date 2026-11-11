# frontend

> Ancla: `apps/frontend`.
> Confianza: **Leído**. Los 200 de las rutas están **Medidos**.

## Rol

Es una aplicación Next.js 15 con App Router que renderiza toda la interfaz y habla **directamente con los dos backends**, sin capa intermedia. No tiene Route Handlers ni Server Actions: es una SPA cliente servida por Next.

## Entrada y composición

El layout raíz envuelve todo en tres capas: un guard de autenticación, el layout visual de la aplicación y un contenedor de notificaciones. No hay provider de React Query ni de estado global más allá de Zustand.

## Rutas

| Ruta | Qué hace | Guard |
|---|---|---|
| `/` | Punto de entrada; decide a dónde ir según el estado de auth | público |
| `/login` | Formulario de inicio de sesión | solo anónimos |
| `/register` | Formulario de registro con elección de dificultad | solo anónimos |
| `/onboarding` | Completa edad, peso, altura y peso objetivo; permite elegir plan | autenticado, obligatorio |
| `/dashboard` | Día actual, metas, racha, puntos, misiones | **marcada como pública** |
| `/calendar` | Historial de días del reto | autenticado |

**Rareza**: `/calendar` es una ruta muerta. No hay ningún `Link` hacia ella en el resto de la aplicación, y sus celdas tienen `cursor-pointer` pero sin `onClick`, así que tampoco abren el detalle del día. El calendario que sí se usa es el mini-calendario del dashboard. Ver `findings.md` F-47.
| `/profile` | Estadísticas, peso, logros, comidas, entrenamientos, Strava | autenticado |
| `/settings` | Perfil, contraseña, tema y paleta | autenticado |

**Medido**: las 8 rutas responden 200 en SSR.

### El guard

El guard distingue cuatro estados: ruta pública, ruta de autenticación, ruta de onboarding y ruta protegida. Espera a la hidratación del store antes de decidir, para evitar parpadeos, y verifica el estado de onboarding **contra la base** en cada arranque, no contra el `localStorage`.

Consecuencia: hay tres redirecciones automáticas (a login, a dashboard si ya está logueado, a onboarding si falta completarlo) y una pantalla de carga mientras se resuelve.

`/dashboard` está declarada pública. En la práctica la página carga, sus llamadas reciben 401 y el cliente HTTP redirige al login, así que el resultado visible es el mismo; pero la protección no viene del guard sino del cliente. Ver `findings.md` F-33.

## Estado

Cinco stores de Zustand:

| Store | Contenido | Persistencia |
|---|---|---|
| `useAuthStore` | Usuario, token, sesión, onboarding | `localStorage` (`auth-storage`), **incluye el token** |
| `useChallengeStore` | Reto, logs por fecha, racha, puntos, misiones | `localStorage` (`challenge-storage`), solo un subconjunto de campos |
| `useQuestStore` | Misiones adoptadas y catálogo disponible | memoria |
| `useThemeStore` | Apariencia y paleta de color | `localStorage` (`theme-storage`) |
| `useUIStore` | Apertura de modales | memoria |

**El token vive en `localStorage`**, legible por cualquier script de la página. Es la decisión de seguridad más importante del frontend: no hay cookie `httpOnly` ni protección contra XSS.

### Lo que sobrevive a un reload

`challenge-storage` **no persiste `startDate` ni `difficulty`**. Tras recargar, el store conserva racha, puntos y día actual, pero perdió el ancla temporal del reto. Consecuencias medidas en el código: `/calendar` muestra "No Active Challenge", el dashboard pinta el plan como `HARD` por defecto y el header cae al mismo valor. Ver `findings.md` F-36.

Tampoco hay un solo sistema de misiones: `useChallengeStore.sideQuests` y `useQuestStore.quests` conviven, y el onboarding escribe en el primero mientras dashboard y perfil leen del segundo. Ver `findings.md` F-42.

## Capa de API

Hay **dos clientes HTTP distintos**:

1. `lib/api/client.ts` — `fetch` para `backend-core`. Lee el token directamente de `localStorage`, inyecta `Authorization`, normaliza los errores (incluye los detalles de Zod en el mensaje) y, ante un 401 en un endpoint que no sea de auth, limpia el storage y redirige a `/login`.
2. `store/useQuestStore.ts` — una instancia de **axios** para las misiones, con su propio interceptor que lee el token del store. No maneja el 401: se limita a guardar el error en el estado.

Los servicios se agrupan por dominio (`auth`, `challenges`, `logs`, `quests`, `users`, `health`) y cada uno tipa su respuesta. La capa de salud tiene su propio cliente contra el segundo backend.

Ver `findings.md` F-32.

## Patrones de UI

- **Actualización optimista** al marcar una meta y al avanzar una misión: el estado se actualiza antes de la respuesta y se revierte si falla.
- **Normalización de fechas**: Prisma devuelve `DateTime` ISO para el campo `date`, así que el frontend recorta a `YYYY-MM-DD` al construir el mapa de logs.
- **Recálculo local del día del reto**: al cargar el reto, el frontend vuelve a calcular el día con su propia fórmula en vez de confiar en el valor del backend. Duplica lógica del servidor. Ver `findings.md` F-35.
- **Errores**: `react-hot-toast` para feedback puntual; varios `console.error` sin superficie al usuario.

## Carga de datos por pantalla

| Pantalla | Fuente |
|---|---|
| Dashboard | `check-reset` → `fetchCurrentChallenge` → misiones |
| Calendario | `useChallengeStore` (logs ya cargados) |
| Perfil | `users/profile` + estadísticas diarias + estado y sincronización de Strava + entrenamientos recientes |
| Settings | actualización de perfil y contraseña; tema |
| Onboarding | auth + inicio de reto + misiones |

**Rareza importante**: el perfil carga cuatro fuentes con `Promise.all` y solo captura el fallo de tres. Si `users/profile` falla —y hoy falla, porque la tabla `Achievement` no existe— se descarta **toda** la información, incluida la de salud que sí había respondido. Ver `findings.md` F-31.

## Temática

Dos ejes: apariencia (claro/oscuro) y paleta de color. El store persiste ambos y aplica la clase al elemento raíz. Hay una utilidad de transición que anima el cambio de tema. El modo oscuro es el valor por defecto.

**Rareza**: el proyecto usa clases `dark:` pero nunca declara `@custom-variant dark` en `globals.css`. En Tailwind v4 eso significa que `dark:` responde a `prefers-color-scheme` del sistema, **no** a la clase `.dark` que aplica el store. El toggle de la app no controla esas clases. Ver `findings.md` F-38.

La paleta personalizada solo redefine la escala `rose-*`; los acentos `emerald`, `sky`, `orange` y `yellow` quedan fijos. Además `tw-animate-css` está instalado pero no importado, así que las clases `animate-in`/`fade-in` no producen animación (F-44).

## Componentes principales

| Componente | Responsabilidad |
|---|---|
| `AuthGuard` | Protección de rutas y gating de onboarding |
| `Layout` | Navegación y estructura visual |
| `DayDetailsModal` | Detalle de un día del calendario |
| `SideQuestsModal` | Catálogo de misiones y adopción |
| `AchievementsModal` | Detalle de logros |
| `PlansModal` | Elección de plan durante el onboarding |
| `LogMealModal` / `EditMealModal` | Alta y edición de comidas, con búsqueda en FatSecret |
| `LogWorkoutModal` | Alta de entrenamientos |
| `EditProfileModal` | Edición de datos personales |

Los modales de comida y entrenamiento concentran la mayor cantidad de lógica de UI: manejan búsqueda remota, selección de porciones, cálculo de macros y validación de formulario en el componente, no en un servicio.

## Dependencia muerta

`@google/genai` figura en `package.json` y `GEMINI_API_KEY` en el `.env.example`, pero **nadie los usa**. Ver `findings.md` F-34 y `integrations.md`.
