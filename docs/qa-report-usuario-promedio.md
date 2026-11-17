# Reporte de QA Exploratorio y Auditoría UX — 75 Days Challenge

**Fecha de ejecución:** 16 de noviembre de 2026 (22:42–22:50 ART, `UTC-3`)  
**Entorno probado:** Local Docker Compose (`http://localhost:3000` frontend Next.js · `http://localhost:3001` backend-core · `http://localhost:3002` backend-health · PostgreSQL 16)  
**Skills aplicadas:** `ux-audit`, `dogfood`, `playwright-skill`, `exploratory-testing`  
**Veredicto general:** **FAIL** (presencia de errores HTTP `500` y `404` en flujos autenticados, errores de consola, Google Login inoperativo con mensaje técnico expuesto, y bug visual en `/register`).

---

## 1. Perfil de Usuario Simulado (Persona Lock)

- **Perfil:** Sofía García (32 años), trabajadora de oficina, **sin conocimientos de programación**.
- **Objetivo:** Cuidarse, construir un hábito saludable y sostener una rutina diaria durante 75 días sin complicarse la vida.
- **Expectativa y estado emocional:** Busca **simpleza**, claridad desde el primer minuto y **no sentirse abrumada** completando demasiados datos personales (edad, altura, peso, metas de IMC) en una app que recién conoce y en la que todavía está construyendo confianza.

---

## 2. Resumen de Resultados por Funcionalidad

| # | Funcionalidad | Ruta | Resultado | Estado |
|---|---|---|---|---|
| 1 | Entrada a la app | `/` | Redirige inmediatamente a `/login` sin explicar qué es la app | ⚠️ Fricción UX |
| 2 | Login con Google | `/login` | Muestra error técnico `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | ❌ **Bug Crítico** |
| 3 | Login con Email (inválido) | `/login` | Muestra `"Correo o contraseña incorrectos"` + HTTP `401` | ✅ Funciona |
| 4 | Login con Email (válido) | `/login` | Inicia sesión (HTTP `200`) y redirige según estado de onboarding | ✅ Funciona |
| 5 | Registro con Email | `/register` | Botón `Crear cuenta` y checkbox invisibles (`opacity: 0`) antes de hacer scroll; al scrollear registra bien (HTTP `201`) | ❌ **Bug Alto (Visual/UI)** |
| 6 | Onboarding (7 pasos) | `/onboarding` | 7 pasos obligatorios/secuenciales antes del Dashboard; header muestra `"ACTIVO"` y countdown antes de empezar; edad/altura/peso no tienen botón "Omitir" | ⚠️ Fricción UX Alta |
| 7 | Tour inicial en Dashboard | `/dashboard` | 9 pasos adicionales tras el onboarding (`16` pasos en total); botón `Saltar` funciona | ⚠️ Fricción UX |
| 8 | Tareas diarias del reto | `/dashboard` | Tildar las 4 tareas actualiza el progreso al 100% y persiste tras recargar (`F5`) | ✅ Funciona |
| 9 | Sincronización `/api/sync` | `/dashboard`, `/profile` | Frontend llama a `GET :3001/api/sync?...` y recibe **404 Not Found** en cada visita | ❌ **Bug Crítico (Red/Consola)** |
| 10 | Acción rápida `+` → Comida | `/dashboard` | Buscador online (`FatSecret`) devuelve **HTTP 500** y dice `"No se encontraron resultados"` | ❌ **Bug Crítico** |
| 11 | Acción rápida `+` → Entrenamiento | `/dashboard` | Guarda entrenamiento (`POST :3002/api/workouts` → `201 Created`, `262.5 kcal`) | ✅ Funciona |
| 12 | Misiones secundarias | `/dashboard` | Listar misiones y suscribirse (`Detox de Azúcar`) funciona y actualiza el contador | ✅ Funciona |
| 13 | Calendario (Mapa y Agenda) | `/calendar` | Muestra `Día 1 · 0 completados` y fecha `Mar 17 Nov (Sin registro)` pese a tener el Día 1 al 100% en Dashboard | ❌ **Bug Alto (Zona horaria/Estado)** |
| 14 | Perfil y Logros | `/profile` | Muestra resumen, peso, nutrición, racha (`1 día`) y logro `Primer Paso`; `Conectar Strava` falla con **HTTP 500** | ❌ **Bug Alto (Strava 500)** |
| 15 | Ajustes (5 pestañas) | `/settings` | Navegación entre las 5 pestañas funciona sin errores | ✅ Funciona |
| 16 | Cerrar sesión | `/profile` | Abre modal de confirmación y redirige a `/login` al confirmar | ✅ Funciona |
| 17 | Vista móvil (`375×812`) | Todas | Sin desborde horizontal (`scrollWidth === 375`), pero la barra `Demo data / Día 1/75` tapa contenido | ⚠️ Bug Visual / Dev Chrome |

---

## 3. Secuencias Paso a Paso y Hallazgos Detallados

### 3.1. Entrada y Autenticación (`/`, `/login`, `/register`)

**Secuencia probada:**
1. Navegar a `http://localhost:3000/`.
2. Hacer clic en **Continuar con Google** en `/login`.
3. Volver a `/login`, hacer clic en **Continuar con email**, probar credenciales inválidas (`noexiste@example.com` / `wrongpass`).
4. Navegar a `/register`, inspeccionar visibilidad inicial, scrollear hasta `Crear cuenta`, probar envío vacío y luego registrar a `Sofía García` (`sofia.onb.<timestamp>@example.com`).

**Resultados observados:**
- Al entrar a `/`, la app redirige directo a `/login` sin pantalla de bienvenida ni explicación breve de qué ofrece la app.
- Al pulsar **Continuar con Google**, aparece en pantalla:
  > `Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID en las variables de entorno.`
- En `/login`, el enlace `Términos y Condiciones` (`#terminos`) queda fuera de la vista inicial en modo oscuro.
- En `/register`, al cargar la página en `1440×900`, el campo `Confirmar contraseña` aparece desvanecido y tanto el checkbox de términos como el botón **Crear cuenta** tienen `opacity: 0` hasta que el usuario hace scroll (a pesar de que `scrollHeight` es `744px` vs `clientHeight` `736px`, apenas `8px` de diferencia).
- El registro con email válido responde `201 Created` en `POST http://localhost:3001/api/auth/register` y redirige a `/onboarding`.

---

### 3.2. Onboarding (`/onboarding` — 7 pasos)

**Secuencia probada:**
1. Paso 1 (`1/7`): Nombre visible y carga de foto de perfil. Pulsar **Siguiente**.
2. Paso 2 (`2/7`): Edad (ruleta numérica, default `25`). No existe botón para omitir. Pulsar **Siguiente**.
3. Paso 3 (`3/7`): Altura en cm (regla, default `170 cm`). No existe botón para omitir. Pulsar **Siguiente**.
4. Paso 4 (`4/7`): Peso actual en kg (regla, default `70.0 kg`) + cálculo de **IMC estimado**. No existe botón para omitir. Pulsar **Siguiente**.
5. Paso 5 (`5/7`): Peso ideal (`PASO 1 · OPCIONAL`, incluye `"Prefiero no definir una meta por ahora"`). Pulsar **Siguiente**.
6. Paso 6 (`6/7`): Actividades dinámicas opcionales. Pulsar **Saltar**.
7. Paso 7 (`7/7`): Elección de plan (`Soft`, `Medium`, `Hard`, `Custom`). Dejar `Medium` y pulsar **Comenzar Desafío**.

**Resultados observados:**
- `POST /api/challenges/start` → `200 OK`, `PATCH /api/auth/complete-onboarding` → `200 OK`, redirige a `/dashboard`.
- **Inconsistencia observada en red:** Durante el paso 1, `PUT /api/users/profile` devolvió `age: null, weight: null, targetWeight: null, height: null`, y recién al completar el onboarding en `PATCH /api/auth/complete-onboarding` se guardaron los valores por defecto (`age: 25, weight: 70, targetWeight: 65, height: 170`).
- **Inconsistencia visual en header:** Durante todo el onboarding, la barra superior muestra `75 DAYS ACTIVO` y un temporizador `01:15:46 HASTA RESET` antes de que el usuario haya siquiera elegido su plan.

---

### 3.3. Experiencia Cotidiana en Dashboard (`/dashboard`)

**Secuencia probada:**
1. Al entrar a `/dashboard`, se abre el tour interactivo `PASO 1 DE 9 · BIENVENIDA`. Pulsar **Saltar**.
2. Marcar las 4 tareas del Plan Medium: `Dieta Saludable`, `Entrenamiento`, `Lectura (10 págs)`, `Fotos de Progreso`.
3. Recargar la página (`F5`) para validar persistencia.
4. Abrir menú rápido `+` (`Abrir acciones rápidas`) → **Registrar comida** → probar sugerencia rápida `"Pechuga de Pollo"` y pestaña `Mis Comidas`.
5. Abrir menú rápido `+` → **Registrar entrenamiento** → ingresar nota `"Caminata rápida por el parque"` y pulsar **Guardar**.
6. Cambiar a pestaña **Misiones** → **Buscar Nueva Misión** → pulsar **Suscribirse** en `"Detox de Azúcar (Sugar-Free)"`.

**Resultados observados:**
- Las 4 tareas se marcan correctamente, el anillo diario pasa a `100% COMPLETADO`, y todo **persiste tras recargar**.
- **Fallo en red en cada carga:** `GET http://localhost:3001/api/sync?timezoneOffset=180&includeProfile=false` devuelve **404 Not Found**.
- **Fallo en buscador de comidas:** Al buscar `"Pechuga de Pollo"`, `GET http://localhost:3002/api/fatsecret/search?query=Pechuga%20de%20Pollo&page=0` devuelve **500 Internal Server Error**, pero la interfaz le miente al usuario diciendo `"No se encontraron resultados para 'Pechuga de Pollo'."`.
- **Entrenamiento:** `POST http://localhost:3002/api/workouts` devuelve **201 Created** (`caloriesBurned: 262.5`).
- **Misiones:** Suscribirse a `"Detox de Azúcar (Sugar-Free)"` actualiza la pestaña con `Progreso: 0 / 21`.

---

### 3.4. Calendario (`/calendar`), Perfil (`/profile`), Ajustes (`/settings`) y Móvil

**Secuencia probada:**
1. Ir a `/calendar`, revisar vista `Mapa` y cambiar a vista `Agenda`.
2. Ir a `/profile`, revisar secciones `Retos`, `Salud`, `Logros`, abrir modales `Editar`, `Registrar` (nutrición) y `Registrar entrenamiento`, y pulsar `Conectar Strava`.
3. Ir a `/settings` y recorrer las 5 pestañas (`Seguridad`, `Desafío y Membresía`, `Apariencia`, `Notificaciones`, `Guía y Tutorial`).
4. Pulsar `Cerrar sesión` en `/profile` y confirmar en el modal.
5. Repetir recorrida en viewport móvil `375×812`.

**Resultados observados:**
- **Calendario desincronizado:** A pesar de que en `/dashboard` hoy es `Lunes, 16 De Noviembre` y el Día 1 está al `100%` (y en `/profile` figura `Racha: 1 día` y logro `Primer Paso` desbloqueado el `16 nov`), `/calendar` muestra:
  - `Día 1 · 0 completados · 0 no cumplidos`
  - En `Agenda`: `SEMANA ACTUAL: 17 Nov – 23 Nov` y `Día 1 · Mar 17 Nov · Sin registro`.
- **Strava en Perfil:** Pulsar `Conectar Strava` dispara `GET http://localhost:3002/api/strava/auth` → **500 Internal Server Error** (`{"error":"Strava Client ID no configurado en el servidor"}`).
- **Ajustes y Logout:** Todas las pestañas de `/settings` cargan sin errores. El logout con confirmación redirige correctamente a `/login`.
- **Móvil (`375×812`):** Sin scroll horizontal en ninguna ruta, aunque la barra flotante de desarrollo (`Demo data | Día 1/75`) se superpone sobre las tarjetas de tareas y el calendario.

---

## 4. Reporte Técnico de Bugs y Análisis de Causa Raíz

### BUG-01 [CRÍTICO] — Login con Google inoperativo y mensaje técnico expuesto al usuario
- **Dónde:** `/login` → botón `Continuar con Google`.
- **Comportamiento actual:** Muestra `"Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID en las variables de entorno."`
- **Impacto:** Bloquea por completo el registro/inicio de sesión con Google y rompe la confianza de un usuario no técnico al mostrar nombres de variables internas.
- **Causa raíz:** La variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` no está definida en el entorno del contenedor `frontend` (`docker-compose.yml` / `.env.local`), y el componente de login renderiza el mensaje de configuración de desarrollo directamente en la UI en lugar de ocultar el botón o mostrar un aviso amigable.

### BUG-02 [CRÍTICO] — `GET /api/sync` devuelve `404 Not Found` en `/dashboard` y `/profile`
- **Dónde:** `apps/frontend/app/dashboard/page.tsx` y `apps/frontend/app/profile/page.tsx` al llamar a `syncCoreStores()`.
- **Evidencia de red/consola:**
  - `GET http://localhost:3001/api/sync?timezoneOffset=180&includeProfile=false` → `404 (Cannot GET /api/sync)`
  - `GET http://localhost:3001/api/sync?timezoneOffset=180&includeProfile=true` → `404 (Cannot GET /api/sync)`
  - Consola del navegador: `Failed to load resource: the server responded with a status of 404 (Not Found)`.
- **Análisis de causa raíz:** Aunque `apps/backend-core/src/index.ts` (línea 67) ya tiene registrado `app.use('/api/sync', syncRoutes)`, el contenedor `75-days-backend-core-1` ejecuta `npm run dev` (`ts-node src/index.ts`, **sin `nodemon`** ni hot-reload). El proceso de Node en Docker quedó corriendo con una versión previa del código antes de que se agregara la ruta `/api/sync`. El frontend sobrevive gracias al fallback en `apps/frontend/lib/api/sync.ts`, pero genera errores 404 continuos y múltiples requests extra.

### BUG-03 [CRÍTICO] — Buscador de comidas (`FatSecret`) falla con HTTP `500` y muestra mensaje engañoso
- **Dónde:** Modal `Registrar Comida` → `Buscador Online` (ej. clic en `"Pechuga de Pollo"`).
- **Evidencia de red/logs:**
  - Red: `GET http://localhost:3002/api/fatsecret/search?query=Pechuga%20de%20Pollo&page=0` → `500 Internal Server Error` (`{"error":"Error al buscar alimentos en FatSecret."}`).
  - Log de `75-days-backend-health-1`:
    ```
    FatSecret Search Error: FATSECRET_CLIENT_ID or FATSECRET_CLIENT_SECRET is missing
    ```
- **Impacto:** El usuario promedio cree que la app "no tiene" alimentos tan básicos como pechuga de pollo o arroz (`"No se encontraron resultados"`), cuando en realidad el servicio de búsqueda está caído por falta de credenciales.

### BUG-04 [ALTO] — Botón `Conectar Strava` falla con HTTP `500`
- **Dónde:** `/profile` → sección `Actividad` → botón `Conectar Strava`.
- **Evidencia de red/consola:**
  - Red: `GET http://localhost:3002/api/strava/auth` → `500 Internal Server Error` (`{"error":"Strava Client ID no configurado en el servidor"}`).
  - Consola: `Failed to get Strava auth URL Error: Strava Client ID no configurado en el servidor` en `app/profile/page.tsx:242`.
- **Causa raíz:** `STRAVA_CLIENT_ID` no está configurado en `apps/backend-health/.env`, pero el botón sigue visible y activo en la interfaz.

### BUG-05 [ALTO] — Desfase de zona horaria (UTC vs Local) y conteo en `/calendar`
- **Dónde:** `/calendar` (vistas `Mapa` y `Agenda`).
- **Comportamiento actual:** Si el usuario crea/completa su Día 1 a las `22:44 ART (UTC-3)` del `16 de noviembre`, el backend guarda `startDate: "2026-11-17T01:44:42.226Z"`. En `/dashboard` se muestra correctamente `Lunes, 16 De Noviembre` y `100% COMPLETADO`, pero `/calendar` interpreta el Día 1 como `Mar 17 Nov` y muestra `0 completados` y `Sin registro`.
- **Impacto:** Altamente desmotivador para un usuario promedio que completó todas sus tareas del día y al entrar al calendario ve su día como "Sin registro" y `0 completados`.

### BUG-06 [ALTO] — Formulario de `/register` oculta el botón `Crear cuenta` y términos al cargar (`opacity: 0`)
- **Dónde:** `/register` (`AuthShell.tsx` / `globals.css` `.auth-scroll`).
- **Comportamiento actual:** Al abrir `/register` en desktop (`1440×900`), la parte inferior del formulario (`Confirmar contraseña`, checkbox de términos y botón `Crear cuenta`) queda invisible (`opacity: 0`) hasta que el usuario hace scroll.
- **Impacto:** Un usuario convencional puede pensar que la pantalla está rota o incompleta y abandonar el registro.

### BUG-07 [MEDIO] — Controles de desarrollo (`Demo data` / `Día 1/75`) visibles en la interfaz normal
- **Dónde:** Todas las rutas autenticadas (`/dashboard`, `/calendar`, `/profile`, `/settings`).
- **Evidencia:** `apps/frontend/components/dev/DevDatasetPicker.tsx` se renderiza como barra flotante fija en la parte inferior, tapando tarjetas en móvil (`375×812`) y filas del calendario/perfil.

---

## 5. Análisis UX desde el Perfil de Usuario Promedio

Pensando en una persona que solo busca **simpleza**, **confianza** y **mantener su rutina diaria** sin conocimientos técnicos:

1. **Barrera de entrada sin contexto:** Entrar a `/` y caer directo en `"Iniciar sesión"` sin una sola frase que explique qué es la app ni cómo funciona el reto genera desconfianza inmediata.
2. **Sobrecarga inicial (16 pasos antes de empezar):** Entre los **7 pasos de onboarding** y los **9 pasos del tour**, el usuario atraviesa 16 pantallas explicativas/de carga de datos antes de poder simplemente marcar su primera tarea del día.
3. **Pedido obligatorio de datos sensibles sin opción de omitir:** En los pasos 2, 3 y 4 del onboarding se pide **edad, altura, peso actual** y se muestra el **IMC estimado** sin ningún botón de *"Omitir por ahora"*. Para alguien que todavía no confía en la app o solo quiere desarrollar un hábito (ej. leer, caminar, tomar agua), esto se siente invasivo.
4. **Ruido visual técnico en desarrollo:** Ver `"ACTIVO · 01:15:46 HASTA RESET"` durante el onboarding, botones flotantes de `"Demo data"` y `"Debug de tiempo"`, o mensajes con nombres de variables (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) rompe la sensación de app confiable y terminada.
5. **Lo positivo a destacar:** Una vez dentro de `/dashboard`, la tarjeta de **Tareas de Hoy** es muy clara, visualmente limpia, con feedback inmediato al marcar cada hábito y un diseño móvil sin desbordes horizontales.

---

## 6. Recomendaciones Priorizadas

1. **Inmediato (Operativo):** Reiniciar `75-days-backend-core-1` (y considerar `nodemon` en dev) para que `/api/sync` responda `200 OK` y desaparezcan los `404`.
2. **Crítico (Auth & Integraciones):**
   - Configurar `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (o deshabilitar/ocultar el botón de Google si no está configurado en el entorno) y reemplazar mensajes de variables de entorno por textos amigables.
   - Si `FATSECRET_CLIENT_ID` o `STRAVA_CLIENT_ID` no están configurados, deshabilitar o indicar claramente *"Integración no disponible"* en lugar de devolver `500` o `"No se encontraron resultados"`.
3. **Alto (Bugs de producto):**
   - Unificar el cálculo de fecha local (`timezoneOffset`) entre `startDate` del reto y `/calendar` para que el Día 1 completado a la noche coincida en ambos lugares.
   - Corregir el CSS/máscara en `.auth-scroll` de `/register` para que el botón `Crear cuenta` sea siempre visible sin necesidad de scrollear `8px`.
4. **UX para usuario promedio:**
   - Permitir **omitir** edad, altura y peso en el onboarding (o pedirlos recién cuando el usuario quiera usar seguimiento de peso/calorías).
   - Reducir el onboarding + tour a un flujo liviano de 2–3 pasos para que pueda empezar su Día 1 en menos de 30 segundos.
   - Ocultar `DevDatasetPicker` detrás de un flag explícito (ej. `?dev=1` o solo en `/dev/*`) para no ensuciar la experiencia cotidiana.
