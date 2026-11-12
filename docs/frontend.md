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
| `/calendar` | Mapa de 75 días y agenda del reto, con detalle editable por día | autenticado |

La pantalla de calendario es la vista completa del historial. En móvil ofrece Mapa y Agenda; el detalle se abre como bottom sheet, y en escritorio conserva una superficie centrada con el mismo flujo de edición. El dashboard mantiene un acceso compacto al historial.
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
| `useChallengeStore` | Reto, logs por fecha, racha y puntos | `localStorage` (`challenge-storage`), persiste el ancla mínima del reto |
| `useQuestStore` | Misiones adoptadas y catálogo disponible | memoria |
| `useThemeStore` | Apariencia y paleta de color | `localStorage` (`theme-storage`) |
| `useUIStore` | Apertura de modales | memoria |

**El token vive en `localStorage`**, legible por cualquier script de la página. Es la decisión de seguridad más importante del frontend: no hay cookie `httpOnly` ni protección contra XSS.

### Lo que sobrevive a un reload

`challenge-storage` persiste `startDate` y `difficulty` junto con los contadores. Además, el dashboard consulta el backend al montarse, por lo que un storage limpio no deja la pantalla en blanco. Ver `findings.md` F-36 y F-45.

Las misiones adoptadas viven en `useQuestStore.quests`; onboarding, dashboard y perfil usan la misma fuente. Ver `findings.md` F-42.

## Capa de API

Hay **dos clientes HTTP distintos**:

1. `lib/api/client.ts` — `fetch` para `backend-core`. Lee el token directamente de `localStorage`, inyecta `Authorization`, normaliza los errores (incluye los detalles de Zod en el mensaje) y, ante un 401 en un endpoint que no sea de auth, limpia el storage y redirige a `/login`.
2. `store/useQuestStore.ts` — una instancia de **axios** para las misiones, con su propio interceptor que lee el token del store. No maneja el 401: se limita a guardar el error en el estado.

Los servicios se agrupan por dominio (`auth`, `challenges`, `logs`, `quests`, `users`, `health`) y cada uno tipa su respuesta. La capa de salud tiene su propio cliente contra el segundo backend.

Ver `findings.md` F-32.

## Patrones de UI

- **Actualización optimista** al marcar una meta y al avanzar una misión: el estado se actualiza antes de la respuesta y se revierte si falla.
- **Normalización de fechas**: Prisma devuelve `DateTime` ISO para el campo `date`, así que el frontend recorta a `YYYY-MM-DD` al construir el mapa de logs.
- **Recálculo local del día del reto**: al cargar el reto, el frontend calcula el día en calendario local para evitar desfases UTC. El backend sigue siendo la fuente de persistencia y `check-reset` actualiza su contador. Ver `findings.md` F-35.
- **Errores**: `react-hot-toast` para feedback puntual; varios `console.error` sin superficie al usuario.

## Carga de datos por pantalla

| Pantalla | Fuente |
|---|---|
| Dashboard | `fetchCurrentChallenge` → `check-reset` → misiones |
| Calendario | `useChallengeStore` (logs ya cargados) |
| Perfil | `users/profile` + estadísticas diarias + estado y sincronización de Strava + entrenamientos recientes |
| Settings | actualización de perfil y contraseña; tema |
| Onboarding | auth + inicio de reto + misiones |

El perfil carga cuatro fuentes con `Promise.all`; cada fuente tiene un fallback independiente para que un fallo de perfil no descarte salud, Strava o entrenamientos. Ver `findings.md` F-31.

## Temática

Dos ejes: apariencia (claro/oscuro) y paleta de color. El store persiste ambos y aplica la clase al elemento raíz. Hay una utilidad de transición que anima el cambio de tema. El modo oscuro es el valor por defecto.

El proyecto declara `@custom-variant dark` para que las clases `dark:` sigan la clase `.dark` aplicada por el store, no una preferencia ajena al toggle. Ver `findings.md` F-38.

La paleta personalizada solo redefine la escala `rose-*`; los acentos `emerald`, `sky`, `orange` y `yellow` quedan fijos. `tw-animate-css` se importa desde `globals.css` para habilitar las clases `animate-in`/`fade-in` (F-44 resuelto).

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

Gemini no forma parte del producto: se eliminaron `@google/genai` y `GEMINI_API_KEY`. Ver `findings.md` F-34 y `integrations.md`.
